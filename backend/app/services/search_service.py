"""网络搜索服务 - 实时获取最新公考面试题目"""

import asyncio
import json
import random
import re
from datetime import datetime, timedelta

import httpx
from bs4 import BeautifulSoup

from app.config import settings


class SearchService:
    """网络搜索服务"""

    SEARCH_SOURCES = [
        {
            "name": "baidu",
            "url": "https://www.baidu.com/s",
            "params": {"wd": "{query}", "rn": "10", "pn": "{page}"},
            "selector": ".result.c-container h3.t a",
            "content_selector": ".content-right_8Zs40",
        },
        {
            "name": "bing",
            "url": "https://cn.bing.com/search",
            "params": {"q": "{query}", "count": "10", "first": "{page}"},
            "selector": "#b_results h2 a",
            "content_selector": ".b_caption p",
        },
    ]

    TOPIC_KEYWORDS = [
        "高质量发展", "乡村振兴", "数字经济", "科技创新", "共同富裕",
        "碳中和", "教育改革", "医疗健康", "就业创业", "社会治理",
        "文化自信", "生态文明", "一带一路", "民生保障", "基层治理",
        "数据安全", "人工智能", "新能源", "老龄化", "青年发展",
        "营商环境", "放管服", "数字化转型", "双循环", "自贸区",
    ]

    QUESTION_CATEGORY_MAP = {
        "综合分析": ["综合分析", "看法", "理解", "认识", "观点", "评价"],
        "人际沟通": ["沟通", "同事", "领导", "协调", "矛盾", "分歧"],
        "应急应变": ["应急", "突发", "怎么办", "处理", "应对", "紧急"],
        "组织管理": ["组织", "策划", "安排", "调研", "活动", "培训"],
        "自我认知": ["经历", "优势", "规划", "报考", "胜任", "自我介绍"],
    }

    def _build_search_query(self, category: str, exam_type: str = "国考") -> str:
        """构建搜索查询词"""
        year = datetime.now().year
        topic = random.choice(self.TOPIC_KEYWORDS)

        queries = [
            f"{year}年{exam_type}面试真题",
            f"{year}公务员面试{category}真题",
            f"{year}公考面试{topic}真题",
            f"{exam_type}面试{category}真题解析",
            f"{year}事业单位面试{category}真题",
        ]

        return random.choice(queries)

    async def _fetch_page(self, url: str, params: dict) -> str:
        """获取网页内容"""
        try:
            async with httpx.AsyncClient(
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                },
                timeout=30.0,
            ) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                return resp.text
        except Exception as e:
            print(f"[搜索] 获取页面失败: {e}")
            return ""

    def _parse_search_results(self, html: str, source: dict) -> list:
        """解析搜索结果"""
        results = []
        try:
            soup = BeautifulSoup(html, "html.parser")
            links = soup.select(source["selector"])

            for link in links[:5]:
                title = link.get_text(strip=True)
                href = link.get("href", "")

                if not href or not title:
                    continue

                if href.startswith("/"):
                    if source["name"] == "baidu":
                        href = "https://www.baidu.com" + href
                    elif source["name"] == "bing":
                        href = "https://cn.bing.com" + href

                results.append({"title": title, "url": href})

        except Exception as e:
            print(f"[搜索] 解析搜索结果失败: {e}")

        return results

    def _extract_questions_from_content(self, html: str, category: str) -> list:
        """从页面内容中提取面试题目"""
        questions = []

        try:
            soup = BeautifulSoup(html, "html.parser")

            for script in soup(["script", "style"]):
                script.decompose()

            text = soup.get_text(separator="\n")
            lines = text.split("\n")

            current_question = ""
            in_question = False

            for line in lines:
                line = line.strip()
                if not line or len(line) < 10:
                    if current_question:
                        questions.append(current_question.strip())
                        current_question = ""
                        in_question = False
                    continue

                if any(keyword in line for keyword in ["题目", "问题", "请", "谈谈", "分析", "如何"]):
                    if re.match(r"^\d+[.、．]", line) or re.match(r"^[（(]\d+[)）]", line):
                        if current_question:
                            questions.append(current_question.strip())
                        current_question = line
                        in_question = True
                    elif not in_question:
                        if current_question:
                            questions.append(current_question.strip())
                        current_question = line
                        in_question = True
                    else:
                        current_question += " " + line
                elif in_question:
                    current_question += " " + line
                else:
                    continue

            if current_question:
                questions.append(current_question.strip())

            valid_questions = []
            for q in questions:
                q = re.sub(r"\s+", " ", q).strip()
                q = re.sub(r"^[\d.、．（(）)]+\s*", "", q)
                q = re.sub(r"^[一二三四五六七八九十]+[、．]\s*", "", q)

                if len(q) >= 15 and len(q) <= 200:
                    if any(keyword in q for keyword in self.QUESTION_CATEGORY_MAP.get(category, [])):
                        valid_questions.append(q)
                    elif category == "综合分析" and len(q) >= 20:
                        valid_questions.append(q)

            return valid_questions[:5]

        except Exception as e:
            print(f"[搜索] 提取题目失败: {e}")
            return []

    async def _search(self, query: str) -> list:
        """执行搜索并获取题目"""
        all_questions = []
        tasks = []

        for source in self.SEARCH_SOURCES:
            params = {k: v.format(query=query, page=0) for k, v in source["params"].items()}
            tasks.append(self._fetch_page(source["url"], params))

        results = await asyncio.gather(*tasks)

        for i, html in enumerate(results):
            source = self.SEARCH_SOURCES[i]
            if not html:
                continue

            search_results = self._parse_search_results(html, source)

            content_tasks = []
            for item in search_results[:3]:
                content_tasks.append(self._fetch_page(item["url"], {}))

            contents = await asyncio.gather(*content_tasks)

            for content in contents:
                if content:
                    questions = self._extract_questions_from_content(content, "")
                    all_questions.extend(questions)

        return list(set(all_questions))

    async def fetch_latest_questions(
        self,
        category: str = "综合分析",
        exam_type: str = "国考",
        count: int = 3,
    ) -> list:
        """获取最新面试题目"""
        queries = []
        year = datetime.now().year

        for _ in range(3):
            queries.append(self._build_search_query(category, exam_type))
            queries.append(f"{year}年{exam_type}面试{category}真题")
            queries.append(f"{year-1}年{exam_type}面试{category}真题")

        seen_questions = set()
        all_questions = []

        for query in queries[:5]:
            questions = await self._search(query)
            for q in questions:
                if q not in seen_questions:
                    seen_questions.add(q)
                    all_questions.append(q)
                if len(all_questions) >= count * 2:
                    break
            if len(all_questions) >= count * 2:
                break

        if not all_questions:
            return []

        random.shuffle(all_questions)
        return all_questions[:count]

    async def generate_question_with_search(
        self,
        category: str = "综合分析",
        exam_type: str = "国考",
        province: str = "",
    ) -> dict:
        """结合网络搜索生成题目"""
        try:
            latest_questions = await self.fetch_latest_questions(category, exam_type, 3)

            if latest_questions:
                question = random.choice(latest_questions)

                return {
                    "content": question,
                    "difficulty": random.randint(2, 4),
                    "answer_reference": "（请结合实际情况作答）",
                    "category": category,
                    "exam_type": exam_type,
                    "province": province,
                    "status": "search",
                }

        except Exception as e:
            print(f"[搜索出题] 网络搜索失败，使用AI生成: {e}")

        return None
