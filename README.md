# UI5 Message Center

采购协同系统前端应用，基于 OpenUI5 构建。

## 文档导航

- 技术栈总览：../message-center-backend/docs/tech-stack.md
- API 接口清单：../message-center-backend/docs/api-list.md
- 数据库结构文档：../message-center-backend/docs/database-schema.md

## 技术栈

- OpenUI5（sap.m / sap.ui.core）
- JavaScript（UI5 模块化）
- UI5 Tooling（@ui5/cli）
- 开发代理中间件（ui5-middleware-simpleproxy）

## 目录说明

- webapp/controller：页面控制器
- webapp/view：XML 视图
- webapp/model：数据模型与 API 封装
- webapp/i18n：国际化资源
- webapp/css：样式文件

## 安装依赖

```bash
npm install
```

## 启动方式

### 本地开发

```bash
npm run start
```

默认访问地址：

- http://localhost:8080

### 局域网访问

```bash
npm run start:lan
```

### 构建

```bash
npm run build
```

## 前后端联调代理

开发模式下，UI5 中间件已将 /api 代理到后端：

- 代理入口：/api
- 目标地址：http://localhost:3000/api

这意味着前端代码中使用 /api/* 即可，无需写后端完整域名。

## 鉴权与请求机制

统一请求封装位于 webapp/model/apiClient.js，主要能力：

- 自动附加 Bearer Token
- 遇到 401 自动调用 /api/auth/refresh
- 刷新成功后自动重试原请求
- 统一错误消息归一化

## 主要页面模块

- 登录与首页：Login、Home、Profile
- 主数据：SupplierList/SupplierDetail、MaterialList/MaterialDetail、PriceLibrary
- 采购业务：PurchaseOrderList/PurchaseOrderDetail、DeliveryPlanList/DeliveryPlanDetail、InvoiceList/InvoiceDetail
- 系统与权限：UserManagement/UserDetail、SystemManagement
- 流程管理：ProcessManagement、ProcessCategories、ProcessModelList、ProcessModelDetail、DeploymentList、FormConfig

## 路由说明

路由配置位于 webapp/manifest.json，核心路由示例：

- /login
- /home
- /suppliers、/materials
- /purchaseOrders、/deliveryPlans、/invoices
- /processManagement

## 与后端协作

建议通过后端项目中的一键联调命令启动全套服务：

```bash
cd ../message-center-backend
npm run dev:all
```

## 常见问题

1. 前端接口 404

检查 ui5.yaml 是否将 /api 正确代理到 http://localhost:3000/api。

2. 登录后频繁跳回登录页

检查后端 JWT_SECRET 是否变更、/api/auth/refresh 是否可用。
