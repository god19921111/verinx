# 公考星 · AI全真面试模拟工具 - 项目规格说明

## 1. 项目概述

### 1.1 项目名称
公考星 · AI全真面试模拟工具

### 1.2 产品定位
面向公考考生的结构化面试AI模拟平台，提供全真面试场景模拟、智能评分与深度复盘服务。

### 1.3 技术栈
| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React | 18+ |
| 前端语言 | TypeScript | 5+ |
| UI组件库 | Shadcn UI | 最新 |
| CSS框架 | TailwindCSS | 3+ |
| 后端框架 | FastAPI | 0.115+ |
| 后端语言 | Python | 3.11+ |
| 数据库 | PostgreSQL | 15+ |
| 缓存 | Redis | 7+ |
| 音频处理 | Web Audio API | - |
| 视频处理 | MediaRecorder API | - |
| AI服务 | 第三方API (ASR/TTS/LLM) | - |

### 1.4 产品形态
Web前后端分离系统，响应式设计，优先适配PC浏览器，兼容移动端Web。

---

## 2. 功能需求

### 2.1 用户系统

#### 2.1.1 手机号登录
- 支持手机号+验证码登录
- 支持手机号+密码登录（注册后）
- 支持验证码自动填充
- 登录状态持久化（JWT Token）

#### 2.1.2 个人备考档案
- 用户基本信息（姓名、手机号、头像）
- 会员等级标识
- 累计练习次数
- 平均得分
- 练习时长统计

#### 2.1.3 练习历史记录
- 练习记录列表（按时间倒序）
- 每次练习详情（题目、作答、评分、报告）
- 历史记录搜索与筛选

### 2.2 题库系统

#### 2.2.1 题型分类
| 分类 | 说明 |
|------|------|
| 综合分析 | 社会现象、政策理解、名言警句 |
| 人际沟通 | 同事关系、上下级关系、群众沟通 |
| 应急应变 | 突发事件、舆情应对、现场处置 |
| 组织管理 | 活动策划、调研组织、会议安排 |
| 自我认知 | 自我介绍、职业规划、优缺点分析 |

#### 2.2.2 考试类型区分
- 国考
- 各省省考（按省份划分）
- 事业单位

#### 2.2.3 题目管理
- 题目列表展示
- 题目详情查看
- 按分类/考试类型筛选

### 2.3 练习模式

#### 2.3.1 专项单题训练
- 选择题目分类
- 选择考试类型
- 随机抽取单题或自主选题
- 答题界面（计时、语音/文字作答）
- 即时评分与反馈

#### 2.3.2 整套全真模拟考场
流程：候考 → 思考计时 → 答题 → AI压力追问 → 评分离场

| 环节 | 时长 | 说明 |
|------|------|------|
| 候考 | 30秒 | 展示考场规则，准备开始 |
| 思考 | 1-3分钟 | 阅读题目，准备作答 |
| 答题 | 3-5分钟 | 正式作答，支持语音/文字 |
| 追问 | 1-2分钟 | AI根据作答内容进行压力追问，**每套模拟最多触发3次追问** |
| 评分 | - | LLM评分生成报告 |

### 2.4 AI能力集成

#### 2.4.1 TTS语音播报
- 考官语音播报题目
- 支持语音速度调节
- 支持重新播放

#### 2.4.2 ASR语音转文字
- 实时语音转文字
- 支持麦克风授权检测
- 支持语音录制与回放

#### 2.4.3 视频录制（可选）
- 摄像头视频录制
- 视频预览
- 录制状态显示

#### 2.4.4 LLM智能评分
5维度评分体系（权重配置化，存储于后端配置/数据库，支持动态调整）：
| 维度 | 权重 | 说明 | 扩展说明 |
|------|------|------|----------|
| 综合分析 | 25% | 思维深度、逻辑严密性 | - |
| 语言表达 | 20% | 口齿清晰、表达流畅 | - |
| 应变能力 | 20% | 反应敏捷、处理得当 | - |
| 组织协调 | 20% | 条理清晰、计划周全 | - |
| 举止仪表 | 15% | 仪态端庄、自信大方 | ⚠️ 预留扩展接口：二期接入视频仪态识别后，该维度权重和数据来源可平滑切换，无需大规模改动业务逻辑 |

> **隐性风险-评分权重**：举止仪表维度当前仅靠LLM基于文本推断，评分置信度较低。开发时需将该维度的权重配置化（后端配置项或数据库字段），确保二期视频仪态识别接入后可独立调整权重和数据源，避免硬编码导致的重构风险。

### 2.5 复盘报告

#### 2.5.1 结构化报告内容
- 综合得分与各维度得分
- 扣分点详细说明
- 优化话术建议
- 参考作答范例
- 同类题型推荐

#### 2.5.2 报告查看与分享
- 报告详情页
- 报告导出（PDF格式）

### 2.6 会员权限系统

#### 2.6.1 权限对比
| 功能 | 免费用户 | 付费会员 |
|------|----------|----------|
| 每日练习次数 | 5次 | 无限 |
| 视频保存 | 不支持 | 支持 |
| 深度分析报告 | 不支持 | 支持 |
| 题库访问 | 基础题库 | 完整题库 |
| AI追问 | 1轮 | 最多3轮（含免费1轮） |

#### 2.6.2 会员管理
- 会员状态标识
- 会员到期提醒
- 会员购买入口

---

## 3. 非功能需求

### 3.1 免责声明
- 页面必须添加免责声明："AI评分仅作为备考练习参考，不等同考场考官打分"

### 3.2 数据安全
- 用户音视频文件按会员等级设置差异化过期清理策略：
  - 免费用户：录音/视频7天自动清理
  - 付费会员：文件保留时长延长至30天（可配置）
- OSS/本地存储路径做好用户隔离，格式：`/{user_id}/{file_type}/{uuid}.ext`，防止越权访问
- 文件访问需校验用户身份，禁止通过URL直接猜测访问他人文件
- 文件存储路径加密
- 敏感数据传输加密

> **隐性风险-音视频存储**：免费用户与会员的文件保留时长不同，清理任务需按用户会员状态差异化执行；OSS路径必须做用户级隔离，任何文件访问都需鉴权，防止横向越权。

### 3.3 兼容性
- 优先适配PC浏览器（Chrome、Edge、Firefox）
- 兼容移动端Web（Safari、Chrome）

### 3.4 异常处理
- 权限异常友好提示（麦克风/摄像头拒绝授权）
- 断网状态提示与重连机制
- API调用失败重试与降级处理

---

## 4. 数据库设计

### 4.1 数据库表结构

#### 4.1.1 users（用户表）
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 用户唯一标识 |
| phone | VARCHAR(20) | UNIQUE, NOT NULL | 手机号 |
| password | VARCHAR(255) | NULL | 密码（可选） |
| name | VARCHAR(50) | NULL | 用户姓名 |
| avatar | VARCHAR(255) | NULL | 头像URL |
| member_type | VARCHAR(20) | DEFAULT 'free' | 会员类型：free/premium |
| member_expire_at | TIMESTAMP | NULL | 会员到期时间 |
| daily_practice_count | INT | DEFAULT 0 | 今日练习次数 |
| last_practice_date | DATE | NULL | 最后练习日期 |
| total_practice_count | INT | DEFAULT 0 | 累计练习次数 |
| avg_score | DECIMAL(5,2) | DEFAULT 0 | 平均得分 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT NOW() | 更新时间 |

#### 4.1.2 questions（题库表）
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 题目唯一标识 |
| category | VARCHAR(30) | NOT NULL | 题型分类 |
| exam_type | VARCHAR(30) | NOT NULL | 考试类型 |
| content | TEXT | NOT NULL | 题目内容 |
| difficulty | INT | DEFAULT 1 | 难度等级(1-5) |
| answer_reference | TEXT | NULL | 参考作答 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 4.1.3 practice_records（练习记录表）
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 记录唯一标识 |
| user_id | UUID | FOREIGN KEY | 用户ID |
| question_id | UUID | FOREIGN KEY | 题目ID |
| practice_mode | VARCHAR(20) | NOT NULL | 练习模式：single/full |
| thinking_time | INT | NULL | 思考时长(秒) |
| answer_time | INT | NULL | 答题时长(秒) |
| answer_text | TEXT | NULL | 作答文本 |
| audio_url | VARCHAR(255) | NULL | 录音文件URL |
| video_url | VARCHAR(255) | NULL | 视频文件URL |
| score_overall | DECIMAL(5,2) | NULL | 综合得分 |
| score_analysis | DECIMAL(5,2) | NULL | 综合分析得分 |
| score_expression | DECIMAL(5,2) | NULL | 语言表达得分 |
| score_st应变 | DECIMAL(5,2) | NULL | 应变能力得分 |
| score_organization | DECIMAL(5,2) | NULL | 组织协调得分 |
| score_appearance | DECIMAL(5,2) | NULL | 举止仪表得分 |
| report_content | TEXT | NULL | 复盘报告内容 |
| deduction_points | TEXT | NULL | 扣分点说明 |
| optimization_suggestions | TEXT | NULL | 优化建议 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 4.1.4追问记录（follow_up_records）
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 记录唯一标识 |
| practice_record_id | UUID | FOREIGN KEY | 练习记录ID |
| question_text | TEXT | NOT NULL | 追问问题 |
| answer_text | TEXT | NULL | 追问回答 |
| audio_url | VARCHAR(255) | NULL | 追问录音URL |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

#### 4.1.5 verification_codes（验证码表）
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY | 记录唯一标识 |
| phone | VARCHAR(20) | NOT NULL | 手机号 |
| code | VARCHAR(6) | NOT NULL | 验证码 |
| created_at | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

## 5. API接口设计

### 5.1 用户认证接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 发送验证码 | POST | /api/auth/send-code | 发送手机验证码 |
| 验证码登录 | POST | /api/auth/login-code | 验证码登录 |
| 密码登录 | POST | /api/auth/login-password | 密码登录 |
| 注册 | POST | /api/auth/register | 用户注册 |
| 获取用户信息 | GET | /api/user/info | 获取当前用户信息 |
| 更新用户信息 | PUT | /api/user/info | 更新用户信息 |

### 5.2 题库接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取题目列表 | GET | /api/questions | 获取题目列表 |
| 获取题目详情 | GET | /api/questions/{id} | 获取题目详情 |
| 随机获取题目 | GET | /api/questions/random | 随机获取题目 |

### 5.3 练习接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建练习记录 | POST | /api/practice | 创建练习记录 |
| 更新练习记录 | PUT | /api/practice/{id} | 更新练习记录 |
| 获取练习记录列表 | GET | /api/practice | 获取练习记录列表 |
| 获取练习记录详情 | GET | /api/practice/{id} | 获取练习记录详情 |
| 创建追问记录 | POST | /api/practice/{id}/follow-up | 创建追问记录 |

### 5.4 文件上传接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 上传音频文件 | POST | /api/upload/audio | 上传音频文件 |
| 上传视频文件 | POST | /api/upload/video | 上传视频文件 |

### 5.5 AI服务接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| TTS语音合成 | POST | /api/ai/tts | 文字转语音 |
| ASR语音识别 | POST | /api/ai/asr | 语音转文字 |
| LLM评分 | POST | /api/ai/score | AI评分 |
| LLM追问 | POST | /api/ai/follow-up | AI生成追问 |

---

## 6. 前端页面结构

### 6.1 页面列表

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | / | 项目介绍、功能展示、登录入口 |
| 登录页 | /login | 手机号登录 |
| 注册页 | /register | 用户注册 |
| 个人中心 | /profile | 个人档案、练习统计 |
| 题库页 | /questions | 题库列表、题目筛选 |
| 专项训练页 | /practice/single | 单题训练 |
| 全真模拟页 | /practice/full | 整套模拟考场 |
| 练习历史页 | /history | 练习记录列表 |
| 报告详情页 | /report/{id} | 复盘报告详情 |
| 会员页 | /membership | 会员购买与管理 |

### 6.2 核心组件

| 组件 | 说明 |
|------|------|
| ExamTimer | 计时器组件 |
| AudioRecorder | 录音组件 |
| VideoRecorder | 视频录制组件 |
| ScoreCard | 评分卡片组件 |
| ReportView | 报告展示组件 |
| QuestionCard | 题目卡片组件 |

---

## 7. 部署架构

### 7.1 服务器架构
```
┌─────────────────────────────────────────────┐
│              Nginx (反向代理)                │
├─────────────────────────────────────────────┤
│         Frontend (React + Static Files)      │
├─────────────────────────────────────────────┤
│        Backend (FastAPI + Uvicorn)           │
├─────────────────────────────────────────────┤
│  PostgreSQL (数据库)  │  Redis (缓存/会话)    │
└─────────────────────────────────────────────┘
```

### 7.2 文件存储
- 用户上传的音视频文件存储在服务器本地或云存储（如阿里云OSS）
- 文件命名采用UUID，防止泄露敏感信息
- 设置定时任务清理过期文件（7天）

---

## 8. 安全策略

### 8.1 数据安全
- 用户密码使用bcrypt加密存储
- JWT Token设置过期时间（2小时）
- 敏感数据传输使用HTTPS

### 8.2 API安全
- 接口限流（每分钟最多100次请求）
- 请求参数校验
- SQL注入防护
- XSS攻击防护

### 8.3 文件安全
- 文件类型校验
- 文件大小限制（音频10MB，视频50MB）
- 文件路径加密存储

---

## 9. MVP范围说明

### 9.1 包含功能
- ✅ 用户手机号登录、个人备考档案、练习历史记录
- ✅ 公考面试题库（5大分类，3种考试类型）
- ✅ 专项单题训练模式
- ✅ 整套全真模拟考场模式
- ✅ TTS考官语音播报题目
- ✅ ASR语音转文字
- ✅ LLM智能评分（5维度）
- ✅ 结构化复盘报告
- ✅ 会员权限系统（基础功能）
- ✅ 免责声明

### 9.2 不包含功能
- ❌ APP客户端
- ❌ 无领导小组模拟
- ❌ 3D数字人考官
- ❌ 机构后台管理系统
- ❌ 视觉仪态识别
- ❌ 报告PDF导出