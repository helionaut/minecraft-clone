#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

function parseArgs(argv) {
  const args = {
    environment: 'github-pages',
    output: 'reports/deployment/github-pages.json',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--url') {
      args.url = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--environment') {
      args.environment = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--output') {
      args.output = argv[index + 1];
      index += 1;
    }
  }

  if (!args.url) {
    throw new Error('Missing required --url argument.');
  }

  return args;
}

async function appendIfSet(filePath, content) {
  if (!filePath) {
    return;
  }

  await writeFile(filePath, content, { encoding: 'utf8', flag: 'a' });
}

async function postJson(url, payload, label) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} request failed (${response.status}): ${body}`);
  }
}

async function maybeNotifyTelegram(payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log('Telegram notification skipped: TELEGRAM_BOT_TOKEN is not configured.');
    return;
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID is required when TELEGRAM_BOT_TOKEN is set.');
  }

  const body = {
    chat_id: chatId,
    text: [
      'Minecraft Clone deployment updated',
      `Environment: ${payload.environment}`,
      `URL: ${payload.production_url}`,
      `Ref: ${payload.ref}`,
      `SHA: ${payload.sha}`,
      `Run: ${payload.run_url}`,
    ].join('\n'),
    disable_web_page_preview: false,
  };

  if (process.env.TELEGRAM_TOPIC_ID) {
    body.message_thread_id = Number(process.env.TELEGRAM_TOPIC_ID);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Telegram notification failed (${response.status}): ${responseBody}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = {
    environment: args.environment,
    production_url: args.url,
    repository: process.env.GITHUB_REPOSITORY ?? 'unknown',
    ref: process.env.GITHUB_REF_NAME ?? 'unknown',
    sha: process.env.GITHUB_SHA ?? 'unknown',
    run_id: process.env.GITHUB_RUN_ID ?? 'unknown',
    run_url:
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : 'unknown',
    generated_at: new Date().toISOString(),
  };

  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  await appendIfSet(
    process.env.GITHUB_OUTPUT,
    `production_url=${payload.production_url}\nmetadata_path=${args.output}\n`,
  );
  await appendIfSet(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Deployment URL',
      '',
      `- Environment: ${payload.environment}`,
      `- Production URL: ${payload.production_url}`,
      `- Workflow run: ${payload.run_url}`,
      '',
    ].join('\n'),
  );

  if (process.env.SYMPHONY_DEPLOY_WEBHOOK_URL) {
    await postJson(process.env.SYMPHONY_DEPLOY_WEBHOOK_URL, payload, 'Symphony deploy webhook');
  } else {
    console.log('Symphony webhook skipped: SYMPHONY_DEPLOY_WEBHOOK_URL is not configured.');
  }

  await maybeNotifyTelegram(payload);
  console.log(JSON.stringify(payload));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
