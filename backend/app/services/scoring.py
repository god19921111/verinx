"""LLM四维评分服务"""

import json
import re
from typing import Optional

from app.config import settings


CATEGORY_PROMPTS = {
    "综合分析": """我现在要考你一道面试题，直接给我你的分析和回答。

【题目】
{question_content}

【你的回答】
{answer_text}

我要从四个维度给你打分（0-100），别废话，直接干：

1. **综合分析**（30%）：你分析得深不深？有没有多角度思考？观点有没有新意？
2. **言语表达**（25%）：说的顺不顺？条理清不清楚？用词准不准？有没有说服力？
3. **应变能力**（25%）：脑子活不活？能不能灵活应对？
4. **计划组织**（20%）：方案完整吗？能落地吗？资源想清楚了吗？

打分原则：
- 别给我套话空话，结合你回答里的具体内容说事儿
- 好就是好，差就是差，别模棱两可
- 说问题要具体到你回答里的哪句话、哪个观点
- 给建议要直接，别说"加强XX"这种屁话，要说"你应该XX"
- 用朋友的语气，别用"考生""您"这种官话，直接说"你"

严格按JSON返回，不要其他内容：
{{
    "score_analysis": <0-100>,
    "score_expression": <0-100>,
    "score_adaptability": <0-100>,
    "score_organization": <0-100>,
    "report_content": "<直接说你的评价，像朋友聊天，犀利但不伤人，指出亮点和硬伤>",
    "dimension_analysis": {{
        "analysis": "<这个维度你做得怎么样，具体说>",
        "expression": "<这个维度你做得怎么样，具体说>",
        "adaptability": "<这个维度你做得怎么样，具体说>",
        "organization": "<这个维度你做得怎么样，具体说>"
    }},
    "deduction_points": "<直说问题，每条一句话，要具体>",
    "optimization_suggestions": "<怎么改，每条一句话，要具体可执行>"
}}""",

    "人际沟通": """我现在要考你一道面试题，直接给我你的分析和回答。

【题目】
{question_content}

【你的回答】
{answer_text}

我要从四个维度给你打分（0-100），别废话，直接干：

1. **综合分析**（30%）：你对人际关系问题理解深不深？矛盾根源抓到了吗？各方利益考虑到了吗？
2. **言语表达**（25%）：沟通方式对不对？措辞得体吗？
3. **应变能力**（25%）：遇到冲突能不能hold住？情绪管理怎么样？
4. **计划组织**（20%）：沟通方案能落地吗？多方协调想清楚了吗？

打分原则：
- 别给我套话空话，结合你回答里的具体内容说事儿
- 好就是好，差就是差，别模棱两可
- 用朋友的语气，别用"考生""您"这种官话，直接说"你"

严格按JSON返回，不要其他内容：
{{
    "score_analysis": <0-100>,
    "score_expression": <0-100>,
    "score_adaptability": <0-100>,
    "score_organization": <0-100>,
    "report_content": "<直接说你的评价，像朋友聊天，犀利但不伤人>",
    "dimension_analysis": {{
        "analysis": "<具体说>",
        "expression": "<具体说>",
        "adaptability": "<具体说>",
        "organization": "<具体说>"
    }},
    "deduction_points": "<直说问题>",
    "optimization_suggestions": "<怎么改>"
}}""",

    "应急应变": """我现在要考你一道面试题，直接给我你的分析和回答。

【题目】
{question_content}

【你的回答】
{answer_text}

我要从四个维度给你打分（0-100），别废话，直接干：

1. **综合分析**（30%）：你对突发事件的判断准不准？轻重缓急分清了吗？
2. **言语表达**（25%）：紧急情况下说的清不清楚？重点有没有突出？
3. **应变能力**（25%）：方案活不活？有没有预案？风险想到了吗？
4. **计划组织**（20%）：方案完整吗？能执行吗？资源调配效率怎么样？

打分原则：
- 别给我套话空话，结合你回答里的具体内容说事儿
- 好就是好，差就是差，别模棱两可
- 用朋友的语气，别用"考生""您"这种官话，直接说"你"

严格按JSON返回，不要其他内容：
{{
    "score_analysis": <0-100>,
    "score_expression": <0-100>,
    "score_adaptability": <0-100>,
    "score_organization": <0-100>,
    "report_content": "<直接说你的评价，像朋友聊天，犀利但不伤人>",
    "dimension_analysis": {{
        "analysis": "<具体说>",
        "expression": "<具体说>",
        "adaptability": "<具体说>",
        "organization": "<具体说>"
    }},
    "deduction_points": "<直说问题>",
    "optimization_suggestions": "<怎么改>"
}}""",

    "组织管理": """我现在要考你一道面试题，直接给我你的分析和回答。

【题目】
{question_content}

【你的回答】
{answer_text}

我要从四个维度给你打分（0-100），别废话，直接干：

1. **综合分析**（30%）：你对活动目标理解对了吗？需求分析深不深？
2. **言语表达**（25%）：方案说的有条理吗？重点突出了吗？
3. **应变能力**（25%）：预案想全了吗？突发情况考虑到了吗？
4. **计划组织**（20%）：方案完整吗？流程合理吗？时间资源想清楚了吗？

打分原则：
- 别给我套话空话，结合你回答里的具体内容说事儿
- 好就是好，差就是差，别模棱两可
- 用朋友的语气，别用"考生""您"这种官话，直接说"你"

严格按JSON返回，不要其他内容：
{{
    "score_analysis": <0-100>,
    "score_expression": <0-100>,
    "score_adaptability": <0-100>,
    "score_organization": <0-100>,
    "report_content": "<直接说你的评价，像朋友聊天，犀利但不伤人>",
    "dimension_analysis": {{
        "analysis": "<具体说>",
        "expression": "<具体说>",
        "adaptability": "<具体说>",
        "organization": "<具体说>"
    }},
    "deduction_points": "<直说问题>",
    "optimization_suggestions": "<怎么改>"
}}""",

    "自我认知": """我现在要考你一道面试题，直接给我你的分析和回答。

【题目】
{question_content}

【你的回答】
{answer_text}

我要从四个维度给你打分（0-100），别废话，直接干：

1. **综合分析**（30%）：你对自己的认知准不准？跟岗位匹配吗？职业规划靠谱吗？
2. **言语表达**（25%）：说的真诚吗？流畅吗？有说服力吗？
3. **应变能力**（25%）：面对追问能扛住吗？压力下表达稳吗？
4. **计划组织**（20%）：职业规划有章法吗？目标明确吗？路径清吗？

打分原则：
- 别给我套话空话，结合你回答里的具体内容说事儿
- 好就是好，差就是差，别模棱两可
- 用朋友的语气，别用"考生""您"这种官话，直接说"你"

严格按JSON返回，不要其他内容：
{{
    "score_analysis": <0-100>,
    "score_expression": <0-100>,
    "score_adaptability": <0-100>,
    "score_organization": <0-100>,
    "report_content": "<直接说你的评价，像朋友聊天，犀利但不伤人>",
    "dimension_analysis": {{
        "analysis": "<具体说>",
        "expression": "<具体说>",
        "adaptability": "<具体说>",
        "organization": "<具体说>"
    }},
    "deduction_points": "<直说问题>",
    "optimization_suggestions": "<怎么改>"
}}""",
}

DEFAULT_PROMPT = CATEGORY_PROMPTS["综合分析"]


class ScoreService:
    """四维评分服务"""

    def _build_prompt(
        self, question_content: str, answer_text: str, question_category: str
    ) -> str:
        template = CATEGORY_PROMPTS.get(question_category, DEFAULT_PROMPT)
        return template.format(
            question_content=question_content,
            answer_text=answer_text,
        )

    def _parse_llm_response(self, response_text: str) -> dict:
        if not response_text:
            return self._get_default_scores()

        print(f"[评分] AI原始响应(前500字): {response_text[:500]}")

        try:
            # 1. 直接尝试 JSON 解析
            try:
                result = json.loads(response_text.strip())
                if isinstance(result, dict) and "score_analysis" in result:
                    print("[评分] 直接JSON解析成功")
                    return result
            except json.JSONDecodeError:
                pass

            # 2. 尝试提取 JSON 对象并解析
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                text = json_match.group().strip()
                # 移除markdown代码块标记
                text = re.sub(r'```(?:json)?\s*', '', text).strip()

                try:
                    result = json.loads(text)
                    if isinstance(result, dict) and "score_analysis" in result:
                        print("[评分] 提取JSON解析成功")
                        return result
                except json.JSONDecodeError:
                    pass

                # 3. 从 JSON 中直接提取分数字段（绕过转义问题）
                scores = {}
                for field in ["score_analysis", "score_expression", "score_adaptability", "score_organization"]:
                    m = re.search(r'"' + field + r'"\s*:\s*(\d+)', text)
                    if m:
                        scores[field] = int(m.group(1))

                if len(scores) == 4:
                    # 提取 report_content
                    report = ""
                    rm = re.search(r'"report_content"\s*:\s*"([\s\S]*?)"\s*,\s*"dimension', text)
                    if rm:
                        report = rm.group(1)
                    elif '"report_content"' in text:
                        # fallback: try to find the value
                        parts = text.split('"report_content"')
                        if len(parts) > 1:
                            rest = parts[1].strip()
                            if rest.startswith(':'):
                                rest = rest[1:].strip()
                            if rest.startswith('"'):
                                rest = rest[1:]
                            # find the closing quote before the next key
                            for end_key in ['",\n', '",\r', '"}']:
                                idx = rest.find(end_key)
                                if idx > 0:
                                    report = rest[:idx]
                                    break

                    # 提取 deduction_points
                    deduction = ""
                    dm = re.search(r'"deduction_points"\s*:\s*"([\s\S]*?)"\s*,\s*"optimization', text)
                    if dm:
                        deduction = dm.group(1)

                    # 提取 optimization_suggestions
                    suggestions = ""
                    sm = re.search(r'"optimization_suggestions"\s*:\s*"([\s\S]*?)"\s*\}', text)
                    if sm:
                        suggestions = sm.group(1)

                    # 提取 dimension_analysis
                    dim_analysis = {}
                    for dim in ["analysis", "expression", "adaptability", "organization"]:
                        dm2 = re.search(r'"' + dim + r'"\s*:\s*"([\s\S]*?)"', text)
                        if dm2:
                            dim_analysis[dim] = dm2.group(1)

                    print(f"[评分] 正则提取分数成功: {scores}")
                    return {
                        "score_analysis": scores["score_analysis"],
                        "score_expression": scores["score_expression"],
                        "score_adaptability": scores["score_adaptability"],
                        "score_organization": scores["score_organization"],
                        "report_content": report or "AI评分解析成功",
                        "dimension_analysis": dim_analysis or {
                            "analysis": "", "expression": "",
                            "adaptability": "", "organization": "",
                        },
                        "deduction_points": deduction,
                        "optimization_suggestions": suggestions,
                    }

        except Exception as e:
            print(f"[评分] 解析异常: {e}")

        print("[评分] JSON解析失败，使用默认分数")
        return self._get_default_scores()

    def _get_default_scores(self) -> dict:
        return {
            "score_analysis": 60,
            "score_expression": 60,
            "score_adaptability": 60,
            "score_organization": 60,
            "report_content": "评分解析异常，请重新评分",
            "dimension_analysis": {
                "analysis": "无法解析",
                "expression": "无法解析",
                "adaptability": "无法解析",
                "organization": "无法解析",
            },
            "deduction_points": "无法解析",
            "optimization_suggestions": "无法解析",
        }

    def _build_mock_response(self, prompt: str) -> str:
        """根据回答内容生成差异化的Mock评分（AI不可用时的兜底）"""
        import hashlib

        answer_text = ""
        for marker in ["【你的回答】", "你的回答", "【考生回答】", "考生回答"]:
            if marker in prompt:
                idx = prompt.index(marker) + len(marker)
                rest = prompt[idx:].strip()
                for end_marker in ["请从以下", "请严格", "评分要求"]:
                    if end_marker in rest:
                        rest = rest[:rest.index(end_marker)]
                        break
                answer_text = rest.strip()
                break

        if not answer_text:
            answer_text = "（无有效回答内容）"

        answer_len = len(answer_text)
        has_structure = any(w in answer_text for w in ["第一", "第二", "第三", "首先", "其次", "最后", "一是", "二是", "三是", "一方面", "另一方面"])
        has_policy = any(w in answer_text for w in ["政策", "法规", "制度", "规定", "文件", "精神", "要求", "标准"])
        has_depth = answer_len > 100
        has_specific = any(w in answer_text for w in ["例如", "比如", "具体", "举例", "实践", "实际", "经验"])

        base = 55
        if answer_len < 10:
            base = 40
        elif answer_len < 30:
            base = 50
        elif answer_len < 80:
            base = 60
        elif answer_len < 200:
            base = 70
        else:
            base = 78

        analysis = min(100, base + (8 if has_depth else 0) + (5 if has_policy else 0))
        expression = min(100, base + (6 if has_structure else 0))
        adaptability = min(100, base + (4 if has_specific else 0))
        organization = min(100, base + (7 if has_structure else 0) + (3 if has_specific else 0))

        quality_level = "较差" if base < 55 else "中等" if base < 70 else "良好" if base < 80 else "优秀"

        strengths = []
        if has_structure:
            strengths.append("回答具有清晰的结构分层")
        if has_policy:
            strengths.append("引用了政策文件作为支撑")
        if has_specific:
            strengths.append("包含具体实例和实践内容")
        if has_depth and answer_len >= 200:
            strengths.append("分析较为深入全面")

        weaknesses = []
        if not has_structure:
            weaknesses.append("回答缺乏清晰的逻辑结构")
        if not has_policy:
            weaknesses.append("未结合政策文件或理论支撑")
        if not has_specific:
            weaknesses.append("缺少具体实例和实践案例")
        if answer_len < 50:
            weaknesses.append("回答内容过于简短，展开不足")

        report = ""
        if base < 55:
            report = "说实话，这个回答不太OK。思路没展开，要点没踩中，面试这么答很难拿分。"
        elif base < 70:
            report = "中规中矩，但亮点不足。该说的都说了，但没说到点子上，面试官听完记不住你。"
        elif base < 80:
            report = "不错，有自己的想法。但可以更犀利、更有力，把你的观点砸实。"
        else:
            report = "漂亮！逻辑清晰，有深度有料。保持这个状态，面试稳了。"

        if strengths:
            report += f" 亮点：{'、'.join(strengths[:2])}。"
        if weaknesses:
            report += f" 硬伤：{'、'.join(weaknesses[:3])}。"

        dedup_points = "；".join([f"你{w}" for w in weaknesses]) if weaknesses else "没什么明显问题"
        suggestions = "；".join([
            "用'第一、第二、第三'列点，让面试官一眼看到你的逻辑",
            "加一句政策或数据支撑，比如'根据XX文件'，立马提升档次",
            "加一个具体例子，比如'我去年在XX项目中遇到过类似情况'，让回答活起来",
            "结尾升华一下，比如'这让我意识到...'，展示你的思考深度",
        ][:len(weaknesses) or 2])

        return json.dumps({
            "score_analysis": analysis,
            "score_expression": expression,
            "score_adaptability": adaptability,
            "score_organization": organization,
            "report_content": report,
            "dimension_analysis": {
                "analysis": f"综合分析{analysis}分。{'分析到位' if has_depth else '分析太浅'}，{'有政策支撑' if has_policy else '缺政策支撑'}。",
                "expression": f"言语表达{expression}分。{'条理清楚' if has_structure else '有点乱'}。",
                "adaptability": f"应变能力{adaptability}分。{'脑子活' if has_specific else '思路不够活'}。",
                "organization": f"计划组织{organization}分。{'方案完整' if has_structure else '方案不完整'}。",
            },
            "deduction_points": dedup_points,
            "optimization_suggestions": suggestions,
        }, ensure_ascii=False)

    def _calculate_overall_score(self, scores: dict) -> float:
        return round(
            scores.get("score_analysis", 0) * settings.SCORE_WEIGHT_ANALYSIS
            + scores.get("score_expression", 0) * settings.SCORE_WEIGHT_EXPRESSION
            + scores.get("score_adaptability", 0) * settings.SCORE_WEIGHT_ADAPTABILITY
            + scores.get("score_organization", 0) * settings.SCORE_WEIGHT_ORGANIZATION,
            1,
        )

    async def _call_llm(self, prompt: str) -> str:
        import httpx
        import time
        import jwt as jwt_lib

        if settings.ZHIPU_API_KEY:
            try:
                api_key = settings.ZHIPU_API_KEY
                kid, secret = api_key.split(".")
                payload = {
                    "api_key": kid,
                    "exp": int(time.time()) + 3600,
                    "timestamp": int(time.time()),
                }
                token = jwt_lib.encode(
                    payload, secret, algorithm="HS256", headers={"alg": "HS256", "sign_type": "SIGN"}
                )

                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
                        json={
                            "model": "glm-4-flash",
                            "messages": [
                                {"role": "system", "content": "你是VERINX，一个犀利直接的公考面试教练。风格像马斯克：直接、犀利、不说废话、不打官腔。你不用'考生''您'这种称呼，直接说'你'。你会直说哪里好哪里不好，给具体可执行的建议。绝对不要模板化、不要套话。"},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.7,
                        },
                        headers={"Authorization": f"Bearer {token}"},
                        timeout=45.0,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
            except Exception as e:
                print(f"[评分] 智谱GLM调用失败: {e}")

        if settings.DOUBAO_API_KEY:
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(
                        settings.DOUBAO_API_URL,
                        json={
                            "model": settings.LLM_MODEL or "doubao-pro",
                            "messages": [
                                {"role": "system", "content": "你是VERINX，一个犀利直接的公考面试教练。风格像马斯克：直接、犀利、不说废话、不打官腔。"},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.7,
                        },
                        headers={"Authorization": f"Bearer {settings.DOUBAO_API_KEY}"},
                        timeout=45.0,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    if "choices" in data:
                        return data["choices"][0]["message"]["content"]
                    elif "output" in data:
                        return data["output"]
                    return str(data)
                except httpx.HTTPError as e:
                    print(f"[评分] 豆包调用失败: {e}")

        print("[评分] 警告：未配置可用的AI模型，使用Mock评分")
        return self._build_mock_response(prompt)

    async def score(
        self, question_content: str, answer_text: str, question_category: str
    ) -> dict:
        prompt = self._build_prompt(question_content, answer_text, question_category)

        llm_response = await self._call_llm(prompt)

        scores = self._parse_llm_response(llm_response)

        overall = self._calculate_overall_score(scores)

        deduction_points = scores.get("deduction_points", "")
        if isinstance(deduction_points, list):
            deduction_points = "；".join(deduction_points)

        optimization_suggestions = scores.get("optimization_suggestions", "")
        if isinstance(optimization_suggestions, list):
            optimization_suggestions = "；".join(optimization_suggestions)

        dimension_analysis = scores.get("dimension_analysis", {})
        if isinstance(dimension_analysis, str):
            try:
                dimension_analysis = json.loads(dimension_analysis)
            except:
                dimension_analysis = {}

        return {
            "score_overall": overall,
            "score_analysis": scores.get("score_analysis", 0),
            "score_expression": scores.get("score_expression", 0),
            "score_adaptability": scores.get("score_adaptability", 0),
            "score_organization": scores.get("score_organization", 0),
            "report_content": scores.get("report_content", ""),
            "dimension_analysis": dimension_analysis,
            "deduction_points": deduction_points,
            "optimization_suggestions": optimization_suggestions,
            "weights": {
                "analysis": settings.SCORE_WEIGHT_ANALYSIS,
                "expression": settings.SCORE_WEIGHT_EXPRESSION,
                "adaptability": settings.SCORE_WEIGHT_ADAPTABILITY,
                "organization": settings.SCORE_WEIGHT_ORGANIZATION,
            },
        }
