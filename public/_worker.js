import { connect } from "cloudflare:sockets";

const MAX_CONTACT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1200;
const SMTP_HOST = "smtp.qq.com";
const SMTP_PORT = 465;
const encoder = new TextEncoder();

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function splitReceivers(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksLikeContact(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^\+?[0-9][0-9\-\s()]{5,24}$/.test(value);
}

function base64Utf8(value) {
  let binary = "";
  for (const byte of encoder.encode(value)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function wrapBase64(value) {
  return base64Utf8(value).replace(/.{1,76}/g, "$&\r\n").trim();
}

function encodeHeader(value) {
  return `=?UTF-8?B?${base64Utf8(value)}?=`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dotStuff(value) {
  return value.replace(/^\./gm, "..");
}

function buildFeedbackMessage({ senderEmail, receivers, contact, message, page, userAgent, cf }) {
  const submittedAt = new Date().toISOString();
  const country = cf?.country || "unknown";
  const colo = cf?.colo || "unknown";
  const textBody = [
    "出海钱眼收到新的意见反馈",
    "",
    `联系方式: ${contact}`,
    "",
    "留言:",
    message,
    "",
    `页面: ${page || "unknown"}`,
    `时间: ${submittedAt}`,
    `区域: ${country} / ${colo}`,
    `User-Agent: ${userAgent || "unknown"}`,
  ].join("\n");
  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.7;color:#1a1e23">
      <h2 style="margin:0 0 12px;color:#1a1e23">出海钱眼收到新的意见反馈</h2>
      <p><strong>联系方式：</strong>${escapeHtml(contact)}</p>
      <p><strong>留言：</strong></p>
      <pre style="white-space:pre-wrap;background:#f6f8fa;border:1px solid #e3e8ee;border-radius:10px;padding:12px">${escapeHtml(message)}</pre>
      <p style="color:#6a737d;font-size:13px">页面：${escapeHtml(page || "unknown")}</p>
      <p style="color:#6a737d;font-size:13px">时间：${escapeHtml(submittedAt)}</p>
      <p style="color:#6a737d;font-size:13px">区域：${escapeHtml(`${country} / ${colo}`)}</p>
    </div>
  `;
  const boundary = `feedback_${crypto.randomUUID().replace(/-/g, "")}`;
  const subject = `出海钱眼反馈 - ${contact}`;
  const headers = [
    `From: ${encodeHeader("出海钱眼反馈")} <${senderEmail}>`,
    `To: ${receivers.join(", ")}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@fund-feedback.local>`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");

  const plainPart = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(textBody),
  ].join("\r\n");
  const htmlPart = [
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(htmlBody),
    `--${boundary}--`,
  ].join("\r\n");

  return dotStuff(`${headers}\r\n\r\n${plainPart}\r\n${htmlPart}`);
}

async function readSmtpResponse(reader, step) {
  const decoder = new TextDecoder();
  let responseText = "";

  for (;;) {
    const readResult = await Promise.race([
      reader.read(),
      new Promise((resolveNever, reject) => {
        void resolveNever;
        setTimeout(() => reject(new Error(`SMTP timeout at ${step}`)), 20000);
      }),
    ]);
    if (readResult.done) break;
    responseText += decoder.decode(readResult.value, { stream: true });
    const lines = responseText.split(/\r?\n/).filter(Boolean);
    const lastLine = lines[lines.length - 1] || "";
    if (/^\d{3} /.test(lastLine)) {
      return { code: Number(lastLine.slice(0, 3)), text: responseText };
    }
  }

  throw new Error(`SMTP connection closed at ${step}`);
}

function assertSmtp(response, expectedCodes, step) {
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP ${step} failed with ${response.code}`);
  }
}

async function sendLine(writer, line) {
  await writer.write(encoder.encode(`${line}\r\n`));
}

async function sendSmtpFeedback({ senderEmail, senderPassword, receivers, rawMessage }) {
  const socket = connect(
    { hostname: SMTP_HOST, port: SMTP_PORT },
    { secureTransport: "on" },
  );
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();

  try {
    assertSmtp(await readSmtpResponse(reader, "greeting"), [220], "greeting");
    await sendLine(writer, "EHLO fund-feedback.local");
    assertSmtp(await readSmtpResponse(reader, "ehlo"), [250], "ehlo");
    await sendLine(writer, "AUTH LOGIN");
    assertSmtp(await readSmtpResponse(reader, "auth login"), [334], "auth login");
    await sendLine(writer, base64Utf8(senderEmail));
    assertSmtp(await readSmtpResponse(reader, "auth user"), [334], "auth user");
    await sendLine(writer, base64Utf8(senderPassword));
    assertSmtp(await readSmtpResponse(reader, "auth password"), [235], "auth password");
    await sendLine(writer, `MAIL FROM:<${senderEmail}>`);
    assertSmtp(await readSmtpResponse(reader, "mail from"), [250], "mail from");

    for (const receiver of receivers) {
      await sendLine(writer, `RCPT TO:<${receiver}>`);
      assertSmtp(await readSmtpResponse(reader, "rcpt to"), [250, 251], "rcpt to");
    }

    await sendLine(writer, "DATA");
    assertSmtp(await readSmtpResponse(reader, "data"), [354], "data");
    await sendLine(writer, `${rawMessage}\r\n.`);
    assertSmtp(await readSmtpResponse(reader, "message"), [250], "message");
    await sendLine(writer, "QUIT");
  } finally {
    try {
      writer.releaseLock();
      reader.releaseLock();
      socket.close();
    } catch (cleanupError) {
      void cleanupError;
    }
  }
}

async function handleFeedback(request, env) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "请求格式不正确。" }, { status: 415 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (parseError) {
    void parseError;
    return jsonResponse({ ok: false, error: "请求内容无法解析。" }, { status: 400 });
  }

  const website = cleanText(payload.website, 120);
  if (website) {
    return jsonResponse({ ok: true });
  }

  const contact = cleanText(payload.contact, MAX_CONTACT_LENGTH);
  const message = cleanText(payload.message, MAX_MESSAGE_LENGTH);
  const page = cleanText(payload.page, 300);
  if (!contact || !message) {
    return jsonResponse({ ok: false, error: "请填写联系方式和反馈内容。" }, { status: 400 });
  }
  if (!looksLikeContact(contact)) {
    return jsonResponse({ ok: false, error: "请填写有效的手机或邮箱。" }, { status: 400 });
  }

  const senderEmail = env.FEEDBACK_EMAIL_ADDRESS || env.EMAIL_ADDRESS;
  const senderPassword = env.FEEDBACK_EMAIL_PASSWORD || env.EMAIL_PASSWORD;
  const receivers = splitReceivers(env.FEEDBACK_RECEIVER_EMAIL || env.RECEIVER_EMAIL);
  if (!senderEmail || !senderPassword || receivers.length === 0) {
    return jsonResponse({ ok: false, error: "反馈通道尚未配置。" }, { status: 503 });
  }

  const rawMessage = buildFeedbackMessage({
    senderEmail,
    receivers,
    contact,
    message,
    page,
    userAgent: request.headers.get("user-agent") || "",
    cf: request.cf,
  });

  try {
    await sendSmtpFeedback({ senderEmail, senderPassword, receivers, rawMessage });
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("feedback delivery failed", error);
    return jsonResponse({ ok: false, error: "反馈发送失败，请稍后再试。" }, { status: 502 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/feedback") {
      if (request.method === "POST") {
        return handleFeedback(request, env);
      }
      return jsonResponse({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
