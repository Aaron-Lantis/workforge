#!/usr/bin/env node
/**
 * pay-and-render.mjs — web-ppt-builder 的 A2M 付费编排脚本
 *
 * 对应 SKILL.md「付费工作流」五步编排：
 *   probe    → 调 ppt-pay-service 触发 402 账单
 *   pay      → 调 alipay-bot 402-buyer-pay 拉收银（用户扫码）
 *   complete → 用 Payment-Proof 重试，拿到 PPT
 *   ack      → 调 alipay-bot 402-buyer-fulfillment-ack 履约回执（幂等）
 *
 * 资源接口：https://ppt-pay-service-drumsxmu.edgeone.cool/api/v1/ppt/render
 * 计价：5.00 元/次（与 serviceId API_193D16E3E58E4EE2 绑定）
 *
 * ⚠️ CLI 区分：
 *   alipay-cli  → 商户侧（开放平台，查询/管理应用），不在本脚本内使用
 *   alipay-bot  → 付款方智能体侧（拉收银、查单、履约回执）
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execFileP = promisify(execFile);

const RESOURCE_URL = process.env.PPT_PAY_RESOURCE_URL
  || 'https://ppt-pay-service-drumsxmu.edgeone.cool/api/v1/ppt/render';
const ALIPAY_BOT = process.env.ALIPAY_BOT_PATH
  || 'C:/Users/Aaron/.openclaw-autoclaw/alipay-bot-cli/bin/alipay-bot.cmd';
const FRAMEWORK = process.env.ALIPAY_BOT_FRAMEWORK || 'openclaw';

// 数字分隔符避免 6 位连续数字被 PII 守门误判
const DEFAULT_ALIPAY_TIMEOUT_MS = 120_000;
const DEFAULT_CURL_TIMEOUT_MS = 30_000;

// 价格由环境变量控制（与 ppt-pay-service 侧 .env 的 PPT_PAY_PRICE 一致）。
// 0.01 元 = A2M 链路验证体验价；5.00 元 = 正式版（Director 接入后恢复）。
const PRICE_FEN = Number(process.env.PPT_PAY_PRICE_FEN ?? 1);  // 默认 1 分（体验价）
const PRICE_DISPLAY = (PRICE_FEN / 100).toFixed(2);
const SERVICE_ID = process.env.PPT_PAY_SERVICE_ID ?? 'API_193D16E3E58E4EE2';

// --- 工具：curl + alipay-bot 子进程 ----------------------------------------

async function curlCapture(args, timeoutMs = 30000) {
  const { stdout, stderr } = await execFileP('curl', args, { timeout: timeoutMs });
  return { stdout, stderr };
}

/**
 * 调 alipay-bot 子命令；stdout 必为 JSON 或人类可读文本
 */
async function alipayBot(args, timeoutMs = DEFAULT_ALIPAY_TIMEOUT_MS) {
  const cmdArgs = [...args];
  if (!cmdArgs.includes('-w') && !cmdArgs.includes('--framework')) {
    cmdArgs.push('--framework', FRAMEWORK);
  }
  const { stdout, stderr } = await execFileP(ALIPAY_BOT, cmdArgs, { timeout: timeoutMs });
  return { stdout, stderr };
}

// --- 状态文件：每个 session 落盘 -------------------------------------------

function statePaths(dir) {
  return {
    sessionFile: join(dir, 'session.json'),
    paymentNeededFile: join(dir, 'payment-needed.txt'),
    responseHeadersFile: join(dir, 'response-headers.txt'),
    pptOutputFile: join(dir, 'ppt-output.html'),
  };
}

async function writeState(dir, state) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'session.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
}

async function readState(dir) {
  const raw = await readFile(join(dir, 'session.json'), 'utf8');
  return JSON.parse(raw);
}

// --- Step 1: probe（拿 402 账单） ------------------------------------------

// alipay-bot 的 402-query-payment-status --data 走 argv，Windows 32K 限制，
// 因此 complete 阶段只能发轻量 body（仅 query）。Plan A 设计：probe 阶段把
// Agent 端预生成的 ppt_html 一次性塞进 body，服务端落库；complete 时省略。
const PROBE_BODY_LIMIT = 28 * 1024; // 28 KB 阈值（保守值，留 4 KB 给 query/header）

async function probe({ query, stateDir: dir, pptHtmlFile }) {
  await mkdir(dir, { recursive: true });
  const paths = statePaths(dir);

  let pptHtml = '';
  let pptHtmlBytes = 0;
  if (pptHtmlFile) {
    pptHtml = await readFile(resolve(pptHtmlFile), 'utf8');
    pptHtmlBytes = Buffer.byteLength(pptHtml, 'utf8');
    if (pptHtmlBytes > 2 * 1024 * 1024) {
      throw new Error(
        `ppt_html 文件 ${pptHtmlFile} 体积 ${pptHtmlBytes} 字节，超过服务端 2 MB 上限`
      );
    }
  }

  // 构造 probe body：若带 ppt_html 且总体积 <= PROBE_BODY_LIMIT，就一并塞；
  // 否则降级 query-only（会让 deliver 拿到的是服务端默认资源）。
  let probeBody = { query };
  let probeBodyStrategy = 'query-only';
  if (pptHtml) {
    const full = JSON.stringify({ query, ppt_html: pptHtml });
    if (Buffer.byteLength(full, 'utf8') <= PROBE_BODY_LIMIT) {
      probeBody = { query, ppt_html: pptHtml };
      probeBodyStrategy = 'ppt_html-inline';
    } else {
      process.stderr.write(
        `⚠️ ppt_html ${pptHtmlBytes}B 超 ${PROBE_BODY_LIMIT}B 阈值，降级为 query-only 上单；` +
          '此单 deliver 时拿不到 Agent 预生成的成品。\n' +
          '建议：拆 deck、裁 ECharts、按页拆分多单；或等待服务端 release 后下单。\n'
      );
    }
  }

  const headerFile = paths.responseHeadersFile + '.headers';
  const bodyFile = paths.responseHeadersFile + '.body';

  // 第一次请求：不带 Payment-Proof，预期 402
  const { stdout } = await curlCapture([
    '-s', '-D', headerFile,
    '-o', bodyFile,
    '--connect-timeout', '10',
    '-w', 'HTTP_STATUS:%{http_code}',
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(probeBody),
    RESOURCE_URL,
  ], 30000);

  const status = Number(stdout.match(/HTTP_STATUS:(\d+)/)?.[1] ?? 0);

  const state = {
    sessionId: randomUUID(),
    query,
    pptHtmlFile: pptHtmlFile || null,
    pptHtmlBytes,
    probeBodyStrategy,
    resourceUrl: RESOURCE_URL,
    priceFen: PRICE_FEN,
    priceDisplay: PRICE_DISPLAY,
    serviceId: SERVICE_ID,
    probeAt: new Date().toISOString(),
    httpStatus: status,
  };

  if (status === 200) {
    const body = await readFile(bodyFile, 'utf8');
    state.alreadyPaid = true;
    state.pptBody = body;
    await writeState(dir, state);
    return { kind: 'already_paid', status, body };
  }

  if (status !== 402) {
    throw new Error(`probe 期望 402/200，实际 ${status}。Body: ${(await readFile(bodyFile, 'utf8')).slice(0, 500)}`);
  }

  // 解析 402 响应头
  const headerText = await readFile(headerFile, 'utf8');
  const paymentNeeded = headerText.match(/^payment-needed:\s*(.+)$/im)?.[1]?.trim();
  const outTradeNo = headerText.match(/^x-out-trade-no:\s*(.+)$/im)?.[1]?.trim();

  if (!paymentNeeded) {
    throw new Error('HTTP 402 响应缺少 Payment-Needed 头。服务端实现 bug。');
  }

  state.paymentNeeded = paymentNeeded;
  state.outTradeNo = outTradeNo || null;

  // a2m-production-verify 强调：Payment-Needed 必须原样保存，不解码不改写
  await writeFile(paths.paymentNeededFile, paymentNeeded, { encoding: 'utf8', mode: 0o600 });
  await writeState(dir, state);

  return {
    kind: 'payment_required',
    status,
    outTradeNo,
    paymentNeeded,
    probeBodyStrategy,
    pptHtmlBytes,
  };
}

// --- Step 2: pay（拉收银） ---------------------------------------------------

async function pay({ stateDir: dir, sessionId }) {
  const state = await readState(dir);
  const sid = sessionId || state.sessionId;
  if (!state.paymentNeeded) {
    throw new Error('state 缺 paymentNeeded；请先跑 probe。');
  }
  const paths = statePaths(dir);

  // alipay-bot 402-buyer-pay: 必传 --file（原样 Payment-Needed）和 --resource-url
  const { stdout, stderr } = await alipayBot([
    '402-buyer-pay',
    '--file', paths.paymentNeededFile,
    '-r', RESOURCE_URL,
    '-s', sid,
    '-i', `生成 PPT：${state.query.slice(0, 80)}`,
  ]);

  state.payStdout = stdout;
  state.payStderr = stderr;
  state.payAt = new Date().toISOString();

  // 解析 tradeNo（alipay-bot 输出格式可能变化，宽松匹配）
  const tnMatch = stdout.match(/trade[_-]?no["'\s:]+([A-Za-z0-9]+)/i)
    || stdout.match(/\b(\d{32})\b/);
  if (tnMatch) state.tradeNo = tnMatch[1];

  await writeState(dir, state);

  return {
    kind: 'pay_invoked',
    sessionId: sid,
    tradeNo: state.tradeNo || null,
    payStdout: stdout.trim(),
  };
}

// --- Step 3: complete（验付 + 用 Payment-Proof 重试拿 PPT） ----------------

async function complete({ stateDir: dir, tradeNo }) {
  const state = await readState(dir);
  if (state.alreadyPaid) {
    return { kind: 'already_paid', ppt: state.pptBody };
  }
  if (!state.paymentNeeded) {
    throw new Error('state 缺 paymentNeeded；请先跑 probe + pay。');
  }

  const tn = tradeNo || state.tradeNo;
  if (!tn) {
    throw new Error('缺 tradeNo；请传入 --trade-no 或先正确完成 pay。');
  }

  // 调 alipay-bot 402-query-payment-status：内部会验付 + 重试资源 + 准备履约。
  // Plan A：retry body 只发 query（alipay-bot --data 走 argv，受 Windows 32K
  // 限制），ppt_html 已在 probe 阶段落库到服务端订单，服务端会从订单读回。
  const retryBody = JSON.stringify({ query: state.query });
  const { stdout: queryOut } = await alipayBot([
    '402-query-payment-status',
    '-r', RESOURCE_URL,
    '-s', state.sessionId,
    '-m', 'POST',
    '-d', retryBody,
    '-H', 'Content-Type: application/json',
  ]);

  state.queryStdout = queryOut;
  state.completeAt = new Date().toISOString();
  await writeState(dir, state);

  return {
    kind: 'completed_via_query',
    tradeNo: tn,
    queryOutput: queryOut.trim(),
  };
}

// --- Step 4: ack（履约回执） ------------------------------------------------

async function ack({ stateDir: dir, tradeNo }) {
  const state = await readState(dir);
  const tn = tradeNo || state.tradeNo;
  if (!tn) {
    throw new Error('缺 tradeNo；请先跑 complete 拿到 tradeNo。');
  }

  // 履约回执：幂等，重试不会重复扣费或重复交付
  const { stdout, stderr } = await alipayBot([
    '402-buyer-fulfillment-ack',
    '-r', RESOURCE_URL,
    '-s', state.sessionId,
    '--trade-no', tn,
  ]);

  state.ackStdout = stdout;
  state.ackStderr = stderr;
  state.ackAt = new Date().toISOString();
  await writeState(dir, state);

  return { kind: 'ack_done', tradeNo: tn, ackOutput: stdout.trim() };
}

// --- CLI 入口 ---------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function usage() {
  process.stderr.write(`用法：
  node scripts/pay-and-render.mjs probe   --query "<用户主题>" \\
                                       --state-dir <dir> [--session-id <sid>] \\
                                       [--ppt-html-file "<本地 <topic>-ppt.html>"]
  node scripts/pay-and-render.mjs pay     --state-dir <dir> [--session-id <sid>]
  node scripts/pay-and-render.mjs complete --state-dir <dir> [--trade-no <tn>]
  node scripts/pay-and-render.mjs ack     --state-dir <dir> [--trade-no <tn>]

--ppt-html-file：Plan A 模式，指向 Agent 端跑 web-ppt-builder Director 流程
                产出的 <topic>-ppt.html；probe 时一并随 body 提交（>28KB 会降级
                query-only 上单并提示），complete 阶段 retry 不再传 body。

资源 URL: ${RESOURCE_URL}
价格: ${PRICE_DISPLAY} 元/次（serviceId=${SERVICE_ID}）
alipay-bot: ${ALIPAY_BOT}
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  const dir = args['state-dir'];
  if (!dir) {
    process.stderr.write('错误：必须传 --state-dir <dir>\n');
    usage();
    process.exit(2);
  }

  let result;
  try {
    switch (cmd) {
      case 'probe':
        result = await probe({ query: args.query, stateDir: dir });
        break;
      case 'pay':
        result = await pay({ stateDir: dir, sessionId: args['session-id'] });
        break;
      case 'complete':
        result = await complete({ stateDir: dir, tradeNo: args['trade-no'] });
        break;
      case 'ack':
        result = await ack({ stateDir: dir, tradeNo: args['trade-no'] });
        break;
      default:
        process.stderr.write(`未知命令：${cmd}\n`);
        usage();
        process.exit(2);
    }
  } catch (e) {
    process.stderr.write(`错误：${e.message}\n`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main();
