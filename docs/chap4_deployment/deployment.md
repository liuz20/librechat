# MediChat 部署指南

本指南提供在各种医疗环境中部署 MediChat 平台的说明。

## 前提条件

- Node.js (v16+)
- MongoDB (v5+)
- Docker 和 Docker Compose (用于容器化部署)
- 访问所需的 API 端点 (EMR, LIS, PACS 等)
- 用于安全通信的 SSL 证书

## 环境配置

1. 复制示例环境文件:
   ```bash
   cp .env.example .env
   ```

2. 在 `.env` 文件中配置以下部分:

   ### 核心配置
   ```
   # 组织特定设置
   ORGANIZATION_NAME=和康医院
   ORGANIZATION_LOGO_URL=https://example.com/logo.png
   PRIMARY_COLOR=#4a90e2
   SECONDARY_COLOR=#f5f5f5
   
   # API 端点
   EMR_API_ENDPOINT=https://emr.example.com/api
   LIS_API_ENDPOINT=https://lis.example.com/api
   PACS_API_ENDPOINT=https://pacs.example.com/api
   APPOINTMENT_API_ENDPOINT=https://appointments.example.com/api
   
   # 认证
   AUTH_PROVIDER=oauth2
   AUTH_DOMAIN=auth.example.com
   AUTH_CLIENT_ID=your_client_id
   AUTH_CLIENT_SECRET=your_client_secret
   ```

   ### 知识库配置
   ```
   # 知识库连接
   MEDICAL_KB_ENDPOINT=https://kb.example.com/medical
   HOSPITAL_INFO_ENDPOINT=https://kb.example.com/hospital
   MEDICATION_KB_ENDPOINT=https://kb.example.com/medication
   INSURANCE_KB_ENDPOINT=https://kb.example.com/insurance
   ```

   ### AI 模型配置
   ```
   # AI 模型设置
   AI_PROVIDER=openai
   AI_API_KEY=your_api_key
   AI_MODEL=gpt-4
   AI_TEMPERATURE=0.7
   AI_MAX_TOKENS=2000
   ```

## 部署选项

### Docker 部署 (推荐)

1. 构建并启动容器:
   ```bash
   docker-compose up -d
   ```

2. 监控日志:
   ```bash
   docker-compose logs -f
   ```

### 手动部署

1. 安装依赖:
   ```bash
   npm install
   ```

2. 构建应用:
   ```bash
   npm run build
   ```

3. 启动服务器:
   ```bash
   npm start
   ```

## 部署后配置

1. 访问管理面板: `https://your-domain.com/admin`
2. 使用默认管理员凭据登录 (立即更改)
3. 配置以下设置:
   - 用户角色和权限
   - 科室映射
   - 知识库连接
   - 自定义品牌元素

## 扩展考虑

- 对于高流量部署，考虑实施:
  - 负载均衡
  - 数据库分片
  - Redis 缓存
  - 静态资源 CDN

## 监控和维护

- 使用 Prometheus 和 Grafana 设置监控
- 配置数据库自动备份
- 实施日志轮转和归档
- 安排定期安全审计

## 故障排除

常见问题及其解决方案:

1. **外部 API 连接错误**
   - 检查网络连接
   - 验证 API 凭据
   - 确保正确配置 SSL 证书

2. **性能问题**
   - 监控服务器资源 (CPU, 内存, 磁盘)
   - 检查数据库查询性能
   - 优化 AI 模型参数

3. **认证问题**
   - 验证 OAuth 配置
   - 检查用户权限
   - 查看认证日志

## 支持

如需部署帮助，请联系我们的支持团队: [zihao@findzihao.com](mailto:zihao@findzihao.com) 