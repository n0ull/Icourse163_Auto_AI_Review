
# Icourse163 自动AI评分脚本

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Required-blue)
![DeepSeek API](https://img.shields.io/badge/API-DeepSeek-green)

## 项目描述

本脚本为网易云课堂（icourse163.org）的作业批改场景提供AI自动评分功能，通过DeepSeek的API实现（可以用其他的模型，baseurl可以改，不是非要deepseek）：

- 自动解析题目内容和评分标准
- 智能生成客观分数和评语
- 一键填充评分结果
- 支持多评分项独立打分

## 安装步骤

1. 安装用户脚本管理器：
   - [Tampermonkey](https://www.tampermonkey.net/)

2. 获取DeepSeek API密钥：
   - 访问[DeepSeek控制台](https://platform.deepseek.com/)
   - 创建API Key

3. 安装脚本

## 注意事项
>
> 请将代码中的 `sk-xxxxxxxxxxxxxxxxxxx` 替换为您实际的API密钥后使用。建议在使用前阅读DeepSeek的[API计费政策](https://platform.deepseek.com/pricing)和[服务条款](https://platform.deepseek.com/terms)。

## 使用方法

1. 进入网易云课堂批改界面
2. 点击题目区域的「AI 智能评分」按钮
3. 等待约5-15秒（视题目复杂度）
4. 自动填充结果后人工复核
5. 提交评分

## 配置说明

点击页面右上角的「AI 评分配置」面板进行设置：

| 配置项       | 说明                          | 默认值                     |
|--------------|-----------------------------|--------------------------|
| API Base URL | DeepSeek API地址             | <https://api.deepseek.com> |
| API Key      | 身份验证密钥（必填）           | sk-xxxxxxxxxx           |
| 模型选择     | 选模型用的，有框能选如果是deepseek的话 | deepseek-chat           |
| 提示词       | 控制评分风格的指令             | [见代码]                 |
