#!/usr/bin/env node
// FreeToken 一键安装脚本
// 用法：node -e "$(curl -fsSL https://raw.githubusercontent.com/kreator666/freetoken/main/install.js)"
//  或：curl -fsSL https://raw.githubusercontent.com/kreator666/freetoken/main/install.js | node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOME = os.homedir();
const INSTALL_DIR = path.join(HOME, '.freetoken');
const REPO_URL = 'https://github.com/kreator666/freetoken.git';
const BRANCH = 'main';

function run(cmd, cwd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log('\n🚀 FreeToken 一键安装\n');

  // 检查 git
  try {
    execSync('git --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ 请先安装 git：https://git-scm.com/');
    process.exit(1);
  }

  // 检查 node
  try {
    execSync('node --version', { stdio: 'ignore' });
  } catch {
    console.error('❌ 请先安装 Node.js：https://nodejs.org/');
    process.exit(1);
  }

  // 克隆或更新代码
  if (exists(path.join(INSTALL_DIR, '.git'))) {
    console.log('📥 更新 FreeToken 代码...');
    run('git pull origin main', INSTALL_DIR);
  } else {
    if (exists(INSTALL_DIR)) {
      console.log('⚠️  目录已存在，先备份...');
      fs.renameSync(INSTALL_DIR, `${INSTALL_DIR}.backup.${Date.now()}`);
    }
    console.log('📥 下载 FreeToken 代码...');
    run(`git clone --depth 1 -b ${BRANCH} ${REPO_URL} "${INSTALL_DIR}"`, HOME);
  }

  // 安装依赖
  console.log('\n📦 安装依赖...');
  try {
    run('pnpm install', INSTALL_DIR);
  } catch {
    console.log('⚠️ pnpm 不可用，尝试 npm install...');
    run('npm install', INSTALL_DIR);
  }

  // 运行 setup
  console.log('\n🔧 配置 Agent...');
  run(`node --import tsx ads-platform/cli/index.ts setup`, INSTALL_DIR);

  console.log('\n✅ 安装完成！');
  console.log(`项目位置：${INSTALL_DIR}`);
}

main();
