# Fund Selection Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app for mainland investors researching overseas stocks, with US-stock-first popular suggestions and top 10 non-index, non-ETF funds holding the selected stock.

**Architecture:** Precompute a compact static JSON index from the stock holding CSV derived by `config/fund-quarter.json`, then serve it from a React + Vite single-page app. The browser performs local stock search and ranking-mode switching without a backend.

**Tech Stack:** Python CSV preprocessing, React 19, TypeScript, Vite, CSS, lucide-react icons.

---

## File Structure

- `scripts/build_fund_stock_index.py`: reads the configured-quarter stock holding CSV and writes a compact JSON search index.
- `public/data/fund-stock-index-<year>q<quarter>.json`: generated browser data file.
- `src/main.tsx`: React entrypoint.
- `src/App.tsx`: application state, search, ranking-mode flow, and layout composition.
- `src/styles.css`: responsive product UI styling.
- `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`: Vite project files.

## Tasks

### Task 1: Build Search Index

- [ ] Create `scripts/build_fund_stock_index.py` with UTF-8 CSV reading.
- [ ] Parse stock holdings and group rows by `证券代码`.
- [ ] For each stock, keep `topByRatio` sorted by `占净值比例数值` and `topByValue` sorted by `持仓市值(万元)`.
- [ ] Write metadata, US-stock-first overseas popular suggestions, and search records into the configured-quarter JSON data file.
- [ ] Run `python scripts/build_fund_stock_index.py` and verify JSON stock count is non-zero.

### Task 2: Build React App

- [ ] Create a React + Vite app shell.
- [ ] Fetch the configured-quarter JSON data file on load.
- [ ] Implement stock search by code or name with overseas popular suggestions.
- [ ] Show top 10 fund results with fund code, fund type, ratio, market value, shares, and source link.
- [ ] Add ranking toggle for concentration ratio and market value.
- [ ] Add concise data口径 and next-step plan in the UI.

### Task 3: Verify

- [ ] Run `npm install`.
- [ ] Run `npm run build`.
- [ ] Start the dev server.
- [ ] Open the app in a browser and test searching `英伟达` / `NVDA` and `腾讯控股` / `00700`.
- [ ] Verify desktop and mobile layouts render without overlap.
