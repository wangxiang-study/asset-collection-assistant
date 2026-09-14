# 持物 · 网页版

基于 [ItemMemo-APP](https://github.com/FLYFISH567/ItemMemo-APP) 的个人离线资产管理二次开发，界面参考用户提供的持物截图，非持物官方产品。

## 使用

打开此目录对应的 GitHub Pages 地址。Android Chrome 菜单选择“安装应用”或“添加到主屏幕”；iPhone/iPad Safari 分享菜单选择“添加到主屏幕”；电脑 Chrome/Edge 可从地址栏安装。

首次联网打开后缓存应用，可离线运行。数据保存在当前浏览器 IndexedDB（必要时回退 localStorage），**不会自动跨设备同步，也不会上传到 GitHub**。换设备请在“我的 → 数据备份”导出 JSON，再在另一设备导入。原离线 HTML 中的数据也可以如此迁移。

## 功能

资产/投资/虚拟、分类和购买渠道、照片和备注、日/次/量成本、成本目标、保障与到期提醒、退役与出售、维护/配件/使用记录、搜索筛选排序、批量分类和删除、统计图表、JSON 备份恢复、CSV 导出、深浅主题。

提醒在打开应用时检查，应用关闭后不发送后台通知。不同币种分别统计。净投入为购入价加计入成本的维护和配件费用、减售出回收；日成本包含购买当天，退役和售出后停止计时。

## 二次开发

`source/` 内保留可编辑源码与构建脚本。

```sh
cd source
npm ci
npm run build
node publish-web.mjs
```

上游版本：`67fb59f28d0ee160ee468a3ce7044a0be9245540`。复用扩展了 `appService.ts`、`types.ts`、日期与ID辅助逻辑，将存储迁移为浏览器 IndexedDB 适配层。原始授权见 `source/LICENSE-ItemMemo.txt`，MIT © 2026 FLYFISH567。Vue.js 使用 MIT 许可，完整声明也保留在生成的 HTML 中。

本应用的缓存仅作用于 `/chiwu/`，独立于刷题应用。
