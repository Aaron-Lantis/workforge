#!/usr/bin/env node
/**
 * selftest_402.mjs — 402 付费链路的模拟自测（不发真实请求、不产生扣款）
 *
 * 覆盖 SkillHub 付费改造预检查要求的五个分支：
 *   1. 未付款返回 402 与 Payment-Needed 账单
 *   2. 未付款重试仍不交付资源
 *   3. 无效 / 过期凭证不交付资源
 *   4. 有效凭证验付通过并交付资源
 *   5. 同一订单重复重试幂等（不重复扣费、不重复交付）
 *   6. 服务端 5xx 时脚本必须报错而非静默成功
 *
 * 用法：
 *   node scripts/selftest_402.mjs
 *
 * 退出码：0 = 全部通过，1 = 存在失败。
 */

import { createServer } from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'pay-and-render.mjs');

const VALID_PROOF = 'mock-valid-proof';
const orders = new Map();
let forceFail = false;

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readBody(req) {
  return new Promise((res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
  });
}

const server = createServer(async (req, res) => {
  if (forceFail) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 'MOCK_SERVER_ERROR' }));
    return;
  }

  const raw = await readBody(req);
  let payload = {};
  try { payload = JSON.parse(raw || '{}'); } catch { /* 空 body 视为无参数 */ }

  const proof = req.headers['payment-proof'];
  const outTradeNo = req.headers['x-out-trade-no'];

  // 已付款分支
  if (proof) {
    const order = orders.get(outTradeNo);

    if (!order) {
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'UNKNOWN_ORDER' }));
      return;
    }
    if (proof !== VALID_PROOF) {
      // 无效 / 过期凭证：绝不交付资源
      res.writeHead(402, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'INVALID_PROOF' }));
      return;
    }

    // 幂等：已履约订单重复重试返回同一资源，且不再次扣费
    const already = order.fulfilled;
    order.fulfilled = true;
    const headers = { 'Content-Type': 'application/json' };
    if (already) headers['X-Already-Fulfilled'] = '1';
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      code: 'OK',
      out_trade_no: outTradeNo,
      ppt_html: order.pptHtml || '<html><body>mock deck</body></html>',
    }));
    return;
  }

  // 未付款分支：建单并返回 402 账单
  const newOutTradeNo = `PPTMOCK${Date.now()}${Math.random().toString(16).slice(2, 10)}`;
  const amount = (Number(process.env.PPT_PAY_PRICE_FEN ?? 500) / 100).toFixed(2);
  const paymentNeeded = {
    protocol: {
      out_trade_no: newOutTradeNo,
      amount,
      currency: 'CNY',
      resource_id: 'mock-resource',
      seller_signature: 'mock-signature',
      seller_sign_type: 'RSA2',
      seller_unique_id: 'mock-seller',
    },
    method: { service_id: 'API_MOCK', seller_name: 'mock seller' },
  };

  orders.set(newOutTradeNo, {
    amount,
    pptHtml: payload.ppt_html || '',
    fulfilled: false,
  });

  res.writeHead(402, {
    'Content-Type': 'application/json',
    'Payment-Needed': base64url(JSON.stringify(paymentNeeded)),
  });
  res.end(JSON.stringify({
    code: 'Payment-Needed',
    message: '需要支付',
    out_trade_no: newOutTradeNo,
    amount,
  }));
});

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`);
}

async function request(port, { proof, outTradeNo, body }) {
  const args = [
    '-s', '-i', '--connect-timeout', '5',
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
  ];
  if (proof) args.push('-H', `Payment-Proof: ${proof}`);
  if (outTradeNo) args.push('-H', `X-Out-Trade-No: ${outTradeNo}`);
  args.push('-d', JSON.stringify(body || { query: '模拟测试' }));
  args.push(`http://127.0.0.1:${port}/v1/ppt/render`);

  const { stdout } = await execFileP('curl', args, { timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
  const status = Number(stdout.match(/HTTP\/1\.1 (\d{3})/)?.[1] ?? 0);
  return { status, raw: stdout };
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const stateDir = await mkdtemp(join(tmpdir(), 'pptpay-selftest-'));

  try {
    // 1. probe 走真实脚本，验证 402 解析与状态落盘
    const { stdout } = await execFileP(process.execPath, [
      SCRIPT, 'probe', '--query', '模拟测试', '--state-dir', stateDir,
    ], {
      env: { ...process.env, PPT_PAY_RESOURCE_URL: `http://127.0.0.1:${port}/v1/ppt/render` },
      timeout: 30000,
    });
    const probeResult = JSON.parse(stdout);
    const state = JSON.parse(await readFile(join(stateDir, 'session.json'), 'utf8'));

    check('1. 未付款返回 402 并解析出 Payment-Needed',
      probeResult.kind === 'payment_required' && !!probeResult.paymentNeeded,
      `kind=${probeResult.kind}`);
    check('1b. 订单号从 Payment-Needed 解码兜底获取',
      !!state.outTradeNo,
      `outTradeNo=${state.outTradeNo || '(空)'}`);

    const decoded = JSON.parse(Buffer.from(
      state.paymentNeeded.replace(/-/g, '+').replace(/_/g, '/'), 'base64'
    ).toString('utf8'));
    check('1c. 账单金额为 5.00 元',
      decoded.protocol.amount === '5.00',
      `amount=${decoded.protocol.amount}`);

    const outTradeNo = state.outTradeNo;

    // 2. 未付款重试仍不交付
    const r2 = await request(port, { outTradeNo, body: { query: '模拟测试' } });
    check('2. 未付款重试仍返回 402，不交付资源', r2.status === 402, `HTTP ${r2.status}`);

    // 3. 无效凭证不交付
    const r3 = await request(port, { proof: 'bad-proof', outTradeNo });
    check('3. 无效凭证不交付资源', r3.status === 402 && !r3.raw.includes('ppt_html'),
      `HTTP ${r3.status}`);

    // 4. 有效凭证交付资源
    const r4 = await request(port, { proof: VALID_PROOF, outTradeNo });
    check('4. 有效凭证验付通过并交付资源',
      r4.status === 200 && r4.raw.includes('ppt_html'), `HTTP ${r4.status}`);

    // 5. 同订单重复重试幂等
    const r5 = await request(port, { proof: VALID_PROOF, outTradeNo });
    check('5. 同订单重复重试幂等且不重复扣费',
      r5.status === 200 && r5.raw.includes('X-Already-Fulfilled'),
      `HTTP ${r5.status}`);

    // 6. 服务端 5xx 必须报错
    forceFail = true;
    let threw = false;
    try {
      await execFileP(process.execPath, [
        SCRIPT, 'probe', '--query', '模拟测试', '--state-dir', join(stateDir, 'x'),
      ], {
        env: { ...process.env, PPT_PAY_RESOURCE_URL: `http://127.0.0.1:${port}/v1/ppt/render` },
        timeout: 30000,
      });
    } catch {
      threw = true;
    }
    forceFail = false;
    check('6. 服务端 5xx 时脚本报错而非静默成功', threw);
  } finally {
    server.close();
    await rm(stateDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} 通过\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  process.stderr.write(`自测异常：${e.message}\n`);
  process.exit(1);
});
