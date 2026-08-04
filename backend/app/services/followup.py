"""追问生成服务"""

import json
import re

from app.config import settings

MAX_ROUNDS = 3

# 追问生成提示词模板
FOLLOW_UP_PROMPT = """你是VERINX，犀利直接的面试教练，风格像马斯克。

【原始题目】（类别：{question_category}）
{question_content}

【你的回答】
{answer_text}

【当前追问轮次】第{round_number}轮（最多{max_rounds}轮）

根据你的回答，生成一个犀利的追问。原则：
1. 直击你回答中的硬伤或没展开的点
2. 逐步深入，逼你把思考落到实处
3. 别重复原题，也别让你重复自己说过的话
4. 追问要短，不超50字

严格按JSON返回：
{{
    "follow_up_question": "<追问内容>",
    "follow_up_purpose": "<追问目的>"
}}"""


class FollowUpService:
    """追问生成服务"""

    def _build_prompt(
        self,
        question_content: str,
        answer_text: str,
        question_category: str,
        round_number: int,
    ) -> str:
        return FOLLOW_UP_PROMPT.format(
            question_content=question_content,
            answer_text=answer_text,
            question_category=question_category,
            round_number=round_number,
            max_rounds=MAX_ROUNDS,
        )

    def _parse_llm_response(self, response_text: str) -> dict:
        """解析LLM返回的追问结果"""
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                result = json.loads(json_match.group())
                return result
            except json.JSONDecodeError:
                pass

        # 解析失败，直接把原文作为追问
        return {
            "follow_up_question": response_text.strip()[:200] if response_text.strip() else "请进一步阐述你的观点。",
            "follow_up_purpose": "追问解析异常",
        }

    async def _call_llm(self, prompt: str, round_number: int = 1) -> str:
        """调用LLM API（优先使用豆包）"""
        import httpx

        # 优先使用豆包API
        if settings.DOUBAO_API_KEY:
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(
                        settings.DOUBAO_API_URL,
                        json={
                            "model": settings.LLM_MODEL or "doubao-pro",
                            "messages": [
                                {"role": "system", "content": "你是VERINX，犀利直接的面试教练。追问要直击要害，不说废话。"},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.5,
                        },
                        headers={"Authorization": f"Bearer {settings.DOUBAO_API_KEY}"},
                        timeout=60.0,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    if "choices" in data:
                        return data["choices"][0]["message"]["content"]
                    elif "output" in data:
                        return data["output"]
                    return str(data)
                except httpx.HTTPError:
                    pass

        # 通用LLM API
        if settings.LLM_API_KEY and settings.LLM_API_URL:
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(
                        settings.LLM_API_URL,
                        json={
                            "model": settings.LLM_MODEL,
                            "messages": [
                                {"role": "system", "content": "你是VERINX，犀利直接的面试教练。追问要直击要害，不说废话。"},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.5,
                        },
                        headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
                        timeout=60.0,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    if "choices" in data:
                        return data["choices"][0]["message"]["content"]
                    elif "output" in data:
                        return data["output"]
                    return str(data)
                except httpx.HTTPError:
                    pass

        # Mock 模式：根据轮次返回不同追问
        mock_questions = {
            1: "你提到的这个观点，能否举一个具体的例子来说明？",
            2: "如果情况发生变化，你会如何调整你的方案？",
            3: "请总结一下你回答中最核心的观点是什么？",
        }
        return json.dumps({
            "follow_up_question": mock_questions.get(round_number, "请进一步阐述你的观点。"),
            "follow_up_purpose": f"第{round_number}轮追问：戳中要害，逼你深入",
        })

    async def generate(
        self,
        question_content: str,
        answer_text: str,
        question_category: str,
        round_number: int,
    ) -> dict:
        """生成追问"""
        # 强制最大3轮
        if round_number > MAX_ROUNDS:
            return {
                "error": f"追问轮次不能超过{MAX_ROUNDS}轮",
                "round_number": round_number,
            }

        prompt = self._build_prompt(
            question_content, answer_text, question_category, round_number
        )
        llm_response = await self._call_llm(prompt, round_number)
        result = self._parse_llm_response(llm_response)

        return {
            "follow_up_question": result.get("follow_up_question", ""),
            "follow_up_purpose": result.get("follow_up_purpose", ""),
            "round_number": round_number,
            "is_last_round": round_number >= MAX_ROUNDS,
        }
