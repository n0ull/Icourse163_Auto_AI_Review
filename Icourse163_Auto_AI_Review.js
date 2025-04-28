// ==UserScript==
// @name         Icourse163_Auto_AI_Review
// @namespace    Icourse163
// @version      1.0.0
// @description  mooc AI自动评分
// @author       n0ull
// @match        https://www.icourse163.org/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_addStyle
// @connect      *
// ==/UserScript==

const CONFIG = {
    BASE_URL: 'https://api.deepseek.com',
    API_KEY: 'sk-xxxxxxxxxxxxx',
    PROMPT: '请根据参考答案和评分标准给出客观的分数和评语（点评要求言简意赅，一句话。不需要建议内容，仅需要各项的分数和最后的点评内容）：\n',
    MODEL: 'deepseek-chat',
    MAX_TOKENS: 2000
};

GM_addStyle(`
.ai-config {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 20px;
    border: 1px solid #ccc;
    z-index: 9999;
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
}
.config-group { margin: 10px 0; }
.config-label { display: block; margin: 5px 0; }
.config-input { width: 300px; padding: 5px; }
.loading { color: blue; display: none; }
.error { color: red; }

.ai-review-btn {
    margin: 15px 0;
    padding: 10px 20px;
    background: #0084ff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}
.ai-review-btn:hover { background: #0073e6; }
.ai-review-btn:disabled {
    background: #cccccc;
    cursor: not-allowed;
}
`);

class AIClient {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    async getModels() {
        return this._request('GET', '/models');
    }

    async evaluateQuestion(prompt, questionData) {
        const messages = [{
            role: "system",
            content: "你是一个严格的教育评分助手，必须根据评分标准给出0到满分之间的整数分数。"
        }, {
            role: "user",
            content: prompt + JSON.stringify(questionData)
        }];

        return this._request('POST', '/chat/completions', {
            model: CONFIG.MODEL,
            messages,
            max_tokens: CONFIG.MAX_TOKENS
        });
    }

    async _request(method, path, data) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: this.baseUrl + path,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                data: data ? JSON.stringify(data) : undefined,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        resolve(JSON.parse(res.responseText));
                    } else {
                        reject(new Error(`API Error: ${res.status} ${res.statusText}`));
                    }
                },
                onerror: (err) => reject(err)
            });
        });
    }
}

class ReviewAutoFill {
    constructor() {
        this.aiClient = new AIClient(CONFIG.BASE_URL, CONFIG.API_KEY);
        this.models = [];
        this.initUI();
        this.setupObserver();
    }

    initUI() {
        const div = document.createElement('div');
        div.className = 'ai-config';
        div.innerHTML = `
            <h3>AI 评分配置</h3>
            <div class="config-group">
                <label class="config-label">API Base URL:</label>
                <input type="text" id="baseUrl" class="config-input" value="${CONFIG.BASE_URL}">
            </div>
            <div class="config-group">
                <label class="config-label">API Key:</label>
                <input type="password" id="apiKey" class="config-input" value="${CONFIG.API_KEY}">
            </div>
            <div class="config-group">
                <label class="config-label">模型:</label>
                <select id="modelSelect" class="config-input"></select>
                <button id="refreshModels">刷新模型</button>
            </div>
            <div class="config-group">
                <label class="config-label">提示词:</label>
                <textarea id="prompt" class="config-input" rows="4">${CONFIG.PROMPT}</textarea>
            </div>
            <button id="saveConfig">保存配置</button>
            <div class="loading">加载中...</div>
            <div class="error"></div>
        `;
        document.body.appendChild(div);

        document.getElementById('saveConfig').addEventListener('click', () => this.saveConfig());
        document.getElementById('refreshModels').addEventListener('click', () => this.loadModels());
        this.loadModels();
    }

    async loadModels() {
        try {
            this.showLoading();
            const response = await this.aiClient.getModels();

            if (!response?.data?.length) {
                throw new Error('无效的模型列表响应结构');
            }

            const modelSelect = document.getElementById('modelSelect');
            modelSelect.innerHTML = response.data.map(model =>
                `<option value="${model.id}" ${model.id === CONFIG.MODEL ? 'selected' : ''}>
                    ${model.id}${model.object ? ` (${model.object})` : ''}
                </option>`
            ).join('');

        } catch (err) {
            this.showError(`模型加载失败: ${err.message} (状态码: ${err.status || 'N/A'})`);
            console.error('模型加载失败:', err);
        } finally {
            this.hideLoading();
        }
    }

    setupObserver() {
        this.observer = new MutationObserver(() => this.processPage());
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    async processPage() {
        this.addManualButtons();
        // 移除autoProcess调用
    }


    addManualButtons() {
        document.querySelectorAll('.j-evaluate:not(.ai-processed)').forEach(section => {
            section.classList.add('ai-processed');
            const btn = document.createElement('button');
            btn.className = 'ai-review-btn';
            btn.textContent = 'AI 智能评分';
            btn.onclick = () => this.handleManualReview(section);
            section.appendChild(btn);
        });
    }

    // 修改后的handleManualReview方法
    async handleManualReview(section) {
        const btn = section.querySelector('.ai-review-btn');
        try {
            btn.disabled = true;
            btn.textContent = '评分中...';

            // 仅处理当前题目
            const questionData = this.extractQuestionFromSection(section);
            if (!questionData?.parts?.length) {
                throw new Error("无法获取评分标准");
            }

            const response = await this.getAIResponse(questionData);
            this.applyScores(questionData, response);

            GM_notification({ text: '评分完成！', timeout: 2000 });
        } catch (err) {
            console.error(err);
            GM_notification({
                title: '评分失败',
                text: `原因: ${err.message}\n请检查网络或配置`,
                timeout: 5000
            });
        } finally {
            btn.disabled = false;
            btn.textContent = 'AI 智能评分';
        }
    }

    extractQuestions() {
        return Array.from(document.querySelectorAll('.u-questionItem')).map(questionItem => {
            try {
                const points = questionItem.querySelectorAll('.u-point');
                const parts = Array.from(points).map((point, index) => ({
                    element: point,
                    question: point.querySelector('.breif .f-richEditorText')?.textContent
                        ?.replace('得分指导：', '')?.trim() || `评分项 ${index + 1}`,
                    maxScore: parseInt(point.querySelector('.detail p')?.textContent?.match(/满分 (\d+) 分/)?.[1]) || 0
                })).filter(p => p.maxScore > 0);

                if (parts.length === 0) return null;

                return {
                    element: questionItem,
                    question: questionItem.querySelector('.j-questionTitle')?.textContent?.trim() || '未知题目',
                    answer: questionItem.querySelector('.j-richOrText')?.textContent?.replace('回答：', '')?.trim() || '无回答内容',
                    parts: parts,
                    maxScore: parts.reduce((sum, p) => sum + p.maxScore, 0)
                };
            } catch (err) {
                console.error('题目解析失败:', err);
                return null;
            }
        }).filter(Boolean);
    }

    extractQuestionFromSection(section) {
        try {
            const questionElem = section.querySelector('.breif .f-richEditorText');
            if (!questionElem) throw new Error('找不到问题元素');

            const points = Array.from(section.querySelectorAll('.u-point')).map(point => {
                const question = point.querySelector('.breif .f-richEditorText')?.textContent
                    ?.replace('得分指导：', '')
                    ?.trim() || '未知评分项';

                const maxScoreText = point.querySelector('.detail p')?.textContent || '';
                const maxScore = parseInt(maxScoreText.match(/满分 (\d+) 分/)?.[1]) || 0;

                return { element: point, question, maxScore };
            }).filter(p => p.maxScore > 0);

            if (points.length === 0) {
                throw new Error("未找到有效评分项");
            }

            const answerElem = section.closest('.u-questionItem')?.querySelector('.j-richOrText');
            if (!answerElem) throw new Error('找不到答案元素');

            return {
                element: section,
                question: questionElem.textContent.replace('得分指导：', '').trim(),
                answer: answerElem.textContent.replace('回答：', '').trim(),
                parts: points,
                maxScore: points.reduce((sum, p) => sum + p.maxScore, 0),
                scoringGuide: questionElem.textContent.trim()
            };
        } catch (err) {
            console.error('题目解析失败:', err);
            GM_notification({
                title: '数据异常',
                text: '请确认：1. 已进入批改模式 2. 题目加载完成',
                timeout: 5000
            });
            throw err;
        }
    }

    async getAIResponse(questionData) {
        let content = null;
        let response = null;

        try {
            if (!questionData?.parts?.length) {
                throw new Error("无效的问题数据");
            }

            const prompt = `${CONFIG.PROMPT}${this.buildScoringGuide(questionData)}\n请严格按照以下格式回复：\n${this.buildResponseTemplate(questionData)}`;

            response = await this.aiClient.evaluateQuestion(prompt, {
                question: questionData.question,
                answer: questionData.answer,
                scoringGuide: questionData.scoringGuide,
                maxScore: questionData.maxScore,
                items: questionData.parts.map(p => p.question)
            });

            if (!response?.choices?.[0]?.message?.content) {
                console.error("API响应异常:", response);
                throw new Error("API返回格式异常");
            }

            content = response.choices[0].message.content;
            const jsonMatch = content.match(/\{[\s\S]*?\}(?=\s*$)/);
            if (!jsonMatch) throw new Error("未找到有效JSON");

            const result = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(result.scores)) {
                throw new Error("评分项数据格式错误");
            }

            return {
                scores: this.normalizeScores(result.scores, questionData),
                comment: result.comment?.trim() || "AI未生成评语"
            };
        } catch (e) {
            console.error('[ERROR]', {
                error: e,
                contentPreview: content?.slice(0, 100),
                questionData: {
                    question: questionData.question,
                    partsCount: questionData.parts?.length
                }
            });
            throw new Error(`AI处理失败: ${e.message}`);
        }
    }
    buildScoringGuide(questionData) {
        return questionData.parts.map((part, index) =>
            `评分项 ${index + 1}：${part.question}（0~${part.maxScore}分）`
        ).join('\n');
    }

    buildResponseTemplate(questionData) {
        return `{
    "scores": [
        ${questionData.parts.map((p, i) => `{
            "item": "评分项${i + 1}",
            "score": ${p.maxScore}分以内的整数
        }`).join(',\n        ')}
    ],
    "comment": "总评语"
}`;
    }

    normalizeScores(scores, questionData) {
        return scores.map((s, index) => {
            const maxScore = questionData.parts[index].maxScore;
            let score = parseFloat(s.score);

            // 边界修正逻辑
            if (isNaN(score)) score = 0;
            score = Math.min(Math.max(score, 0), maxScore);

            // 记录修正情况
            if (score !== parseFloat(s.score)) {
                GM_notification({
                    title: '分数修正通知',
                    text: `评分项${index + 1}: ${s.score} → ${score}`,
                    timeout: 3000
                });
            }

            return score;
        });
    }

    // 修改后的applyScores方法（仅处理单个题目）
    applyScores(question, response) {
        if (response.scores.length !== question.parts.length) {
            throw new Error("评分项数量不匹配");
        }

        question.parts.forEach((part, index) => {
            const score = response.scores[index];
            const inputs = part.element.querySelectorAll('input[type="radio"]');
            const targetInput = Array.from(inputs).find(input => {
                const value = parseFloat(input.value);
                return Math.abs(value - score) < 0.1;
            });

            if (targetInput) {
                targetInput.checked = true;
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.warn(`未找到匹配的分数选项: ${score}`);
            }
        });

        const commentArea = question.element.querySelector('.j-textarea');
        if (commentArea && response.comment) {
            commentArea.value = response.comment;
            commentArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    saveConfig() {
        CONFIG.BASE_URL = document.getElementById('baseUrl').value;
        CONFIG.API_KEY = document.getElementById('apiKey').value;
        CONFIG.MODEL = document.getElementById('modelSelect').value;
        CONFIG.PROMPT = document.getElementById('prompt').value;

        this.aiClient = new AIClient(CONFIG.BASE_URL, CONFIG.API_KEY);
        GM_notification({
            title: '配置已保存',
            text: `当前模型: ${CONFIG.MODEL}`,
            timeout: 1500
        });
    }

    showLoading() {
        document.querySelector('.loading').style.display = 'block';
    }

    hideLoading() {
        document.querySelector('.loading').style.display = 'none';
    }

    showError(msg) {
        document.querySelector('.error').textContent = msg;
    }
}

window.addEventListener('load', () => new ReviewAutoFill());
