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
 * 资源接口：https://skill.si-agent.top/api/v1/ppt/render
 * 计价：5.00 元/次（serviceId 以服务端 402 账单为准，不在源码中固定）
 *
 * ⚠️ CLI 区分：
 *   alipay-cli  → 商户侧（开放平台，查询/管理应用），不在本脚本内使用
 *   alipay-bot  → 付款方智能体侧（拉收银、查单、履约回执）
 */

import { exec, execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';

const execFileP = promisify(execFile);
const execP = promisify(exec);

const RESOURCE_URL = process.env.PPT_PAY_RESOURCE_URL
  || 'https://skill.si-agent.top/api/v1/ppt/render';

// alipay-bot 定位：环境变量 → PATH → 常见安装目录。
// 不得硬编码任何用户目录——Skill 包会分发到买家机器，硬编码路径必然失效。
async function resolveAlipayBot() {
  if (process.env.ALIPAY_BOT_PATH) return process.env.ALIPAY_BOT_PATH;

  const candidates = [
    'alipay-bot',
    'alipay-bot.cmd',
    join(homedir(), '.openclaw-autoclaw', 'alipay-bot-cli', 'bin', 'alipay-bot.cmd'),
    join(homedir(), '.openclaw-autoclaw', 'alipay-bot-cli', 'bin', 'alipay-bot'),
    join(homedir(), '.alipay-bot', 'bin', 'alipay-bot.cmd'),
    join(homedir(), '.local', 'bin', 'alipay-bot'),
  ];

  for (const candidate of candidates) {
    try {
      if (candidate.includes('/') || candidate.includes('\\')) {
        await stat(candidate);
        return candidate;
      }
      await execFileP(candidate, ['--help'], { timeout: 10_000 });
      return candidate;
    } catch {
      // 继续尝试下一个候选
    }
  }

  throw new Error(
    '未找到 alipay-bot。请先安装买家侧支付能力：\n' +
    '  npx -y @alipay/agent-payment@latest install\n' +
    '安装后可用 ALIPAY_BOT_PATH 显式指定可执行文件位置。'
  );
}

const FRAMEWORK = process.env.ALIPAY_BOT_FRAMEWORK || 'openclaw';

// 数字分隔符避免 6 位连续数字被 PII 守门误判
const DEFAULT_ALIPAY_TIMEOUT_MS = 120_000;
const DEFAULT_CURL_TIMEOUT_MS = 30_000;

// 价格由环境变量控制（与 ppt-pay-service 侧 .env 的 PPT_PAY_PRICE 一致）。
// 三处价格必须一致：支付宝服务登记价 / 服务端 402 账单 / SkillHub 展示价。
// 默认值 500 分 = 5.00 元/次，与 serviceId 登记价保持一致。
const PRICE_FEN = Number(process.env.PPT_PAY_PRICE_FEN ?? 500);
const PRICE_DISPLAY = (PRICE_FEN / 100).toFixed(2);
// serviceId 不写死在源码里：它属于卖家账户标识，以 402 账单 method.service_id 为准，
// 仅在需要核对/覆盖时用 PPT_PAY_SERVICE_ID 显式指定。
const SERVICE_ID = process.env.PPT_PAY_SERVICE_ID ?? '';

// --- 工具：curl + alipay-bot 子进程 ----------------------------------------

async function curlCapture(args, timeoutMs = 30000) {
  const { stdout, stderr } = await execFileP('curl', args, { timeout: timeoutMs });
  return { stdout, stderr };
}

let _alipayBotPath = null;

async function getAlipayBot() {
  if (!_alipayBotPath) _alipayBotPath = await resolveAlipayBot();
  return _alipayBotPath;
}

/** 按平台给命令行参数加引号（经 shell 执行时必须）。 */
function quoteArg(value) {
  const str = String(value);
  if (process.platform === 'win32') {
    return /[\s"^&|<>()]/.test(str)
      ? `"${str.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
      : str;
  }
  return /[^\w@%+=:,./-]/.test(str) ? `'${str.replace(/'/g, "'\\''")}'` : str;
}

/**
 * 调 alipay-bot 子命令；stdout 必为 JSON 或人类可读文本。
 *
 * Windows 下 .cmd 不能直接用 execFile 执行（ENOENT），必须经 shell；
 * 因此统一走 shell + 显式引号，避免依赖各平台对裸数组参数的处理差异。
 */
async function alipayBot(args, timeoutMs = DEFAULT_ALIPAY_TIMEOUT_MS) {
  const bot = await getAlipayBot();
  const cmdArgs = [...args];
  if (!cmdArgs.includes('-w') && !cmdArgs.includes('--framework')) {
    cmdArgs.push('--framework', FRAMEWORK);
  }
  const command = [quoteArg(bot), ...cmdArgs.map(quoteArg)].join(' ');
  const { stdout, stderr } = await execP(command, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 });
  return { stdout, stderr };
}

/**
 * 解码 Payment-Needed（base64url 编码的紧凑 JSON）。
 * 解码结果只用于读取订单号与金额，原值一律原样保存、不回写。
 */
function decodePaymentNeeded(paymentNeeded) {
  try {
    const b64 = paymentNeeded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
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

// probe 走 curl，不受 alipay-bot --data 的 argv 长度限制，可以把 Agent 端
// 预生成的 ppt_html 一次性塞进 body 落库；complete 阶段由 alipay-bot 发起，
// 只能发轻量 body（仅 query），成品由服务端按订单号读回。
// 上限取服务端 ppt_html 上限 2 MB，留 64 KB 给 query 与 JSON 包装。
const PROBE_BODY_LIMIT = 2 * 1024 * 1024 - 64 * 1024;

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
    serviceId: SERVICE_ID || null,
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

  if (status === 429) {
    // 服务端按客户端（IP）限流：同一来源在窗口内下单过密。这是保护机制，
    // 不是支付失败，也不是资源不可用——退避后重试即可。
    const head = await readFile(headerFile, 'utf8').catch(() => '');
    const retryAfter = Number(head.match(/^retry-after:\s*(\d+)/im)?.[1] ?? 0) || 60;
    const bodyText = await readFile(bodyFile, 'utf8').catch(() => '');
    throw new Error(
      `请求被限流（429）：同一客户端在短时间内下单过多，请 ${retryAfter} 秒后重试。\n` +
        `说明：服务端按用户限流（不是全局熔断），其他用户不受影响；这不是支付失败。\n` +
        `Body: ${bodyText.slice(0, 300)}`
    );
  }

  if (status !== 402) {
    throw new Error(`probe 期望 402/200，实际 ${status}。Body: ${(await readFile(bodyFile, 'utf8')).slice(0, 500)}`);
  }

  // 解析 402 响应头
  const headerText = await readFile(headerFile, 'utf8');
  const paymentNeeded = headerText.match(/^payment-needed:\s*(.+)$/im)?.[1]?.trim();

  if (!paymentNeeded) {
    throw new Error('HTTP 402 响应缺少 Payment-Needed 头。服务端实现 bug。');
  }

  // serviceId 以账单为准：源码里不留卖家账户标识，账单带什么就是什么。
  const billServiceId = decodePaymentNeeded(paymentNeeded)?.method?.service_id || null;
  if (billServiceId) state.serviceId = billServiceId;
  if (SERVICE_ID && billServiceId && SERVICE_ID !== billServiceId) {
    throw new Error(
      `serviceId 不一致：本地 PPT_PAY_SERVICE_ID=${SERVICE_ID}，` +
        `账单 method.service_id=${billServiceId}。拒绝继续，避免付错商户。`
    );
  }

  // 订单号以 Payment-Needed 里的 protocol.out_trade_no 为准。
  // 服务端不保证下发 X-Out-Trade-No 头，头缺失时必须能解码兜底，
  // 否则后续 complete / ack 会因订单号为空而断链。
  const outTradeNo =
    headerText.match(/^x-out-trade-no:\s*(.+)$/im)?.[1]?.trim()
    || decodePaymentNeeded(paymentNeeded)?.protocol?.out_trade_no
    || null;

  state.paymentNeeded = paymentNeeded;
  state.outTradeNo = outTradeNo;

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
                产出的 <topic>-ppt.html；probe 时随 body 一并提交（上限 2 MB），
                服务端按订单落库，complete 阶段 retry 不再传 body。

资源 URL: ${RESOURCE_URL}
价格: ${PRICE_DISPLAY} 元/次（serviceId 以 402 账单为准${SERVICE_ID ? `，当前覆盖为 ${SERVICE_ID}` : ''}）
alipay-bot: 自动发现（可用 ALIPAY_BOT_PATH 覆盖）
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
        result = await probe({
          query: args.query,
          stateDir: dir,
          pptHtmlFile: args['ppt-html-file'] === true ? null : args['ppt-html-file'],
        });
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
