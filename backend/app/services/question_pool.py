"""题目缓存池 - 预生成题目，避免实时生成延迟"""

import asyncio
import json
import random
import threading
import time
from typing import Optional

from app.config import settings


class QuestionPool:
    """题目缓存池"""

    def __init__(self, pool_size: int = 30):
        self.pool_size = pool_size
        self._pool: dict[str, list[dict]] = {}
        self._lock = threading.Lock()
        self._last_refresh = 0
        self._refreshing = False

        self.CATEGORIES = ["综合分析", "人际沟通", "应急应变", "组织管理", "自我认知"]

        self._init_mock_pool()

    def _init_mock_pool(self):
        """初始化兜底题目池"""
        mock_pool = {
            "综合分析": [
                {"content": "请谈谈你对'高质量发展'的理解，结合实际分析其重要意义和实现路径。", "difficulty": 3, "answer_reference": ""},
                {"content": "数字经济已成为当前社会关注的热点，请你分析其面临的挑战及应对策略。", "difficulty": 3, "answer_reference": ""},
                {"content": "如何看待'乡村振兴'战略在新时代背景下的发展趋势？", "difficulty": 3, "answer_reference": ""},
                {"content": "请结合'科技创新'的发展现状，分析其对经济社会发展的影响。", "difficulty": 3, "answer_reference": ""},
                {"content": "'共同富裕'是当前工作的重点，请谈谈你对推进这项工作的思考。", "difficulty": 3, "answer_reference": ""},
                {"content": "如何理解'碳中和'目标的重要性？结合实际谈谈如何实现这一目标。", "difficulty": 3, "answer_reference": ""},
                {"content": "请分析'教育改革'面临的主要问题及解决思路。", "difficulty": 3, "answer_reference": ""},
                {"content": "如何看待'人工智能'在政务服务中的应用前景？", "difficulty": 3, "answer_reference": ""},
            ],
            "人际沟通": [
                {"content": "你在工作中与同事意见分歧较大，对方坚持自己的观点，你怎么办？", "difficulty": 3, "answer_reference": ""},
                {"content": "领导安排你接手同事未完成的工作，但同事态度不配合，你如何处理？", "difficulty": 3, "answer_reference": ""},
                {"content": "群众来办事时情绪激动，对办理结果不满意，你如何安抚并解决问题？", "difficulty": 3, "answer_reference": ""},
                {"content": "你作为新人，老同事总是把琐碎工作推给你，你如何处理？", "difficulty": 3, "answer_reference": ""},
                {"content": "跨部门协作中，其他部门不配合你的工作，你如何沟通协调？", "difficulty": 3, "answer_reference": ""},
                {"content": "领导批评你的工作方案存在问题，但你认为自己的方案是正确的，你怎么办？", "difficulty": 3, "answer_reference": ""},
                {"content": "同事在背后议论你的工作方式，你得知后如何处理？", "difficulty": 3, "answer_reference": ""},
                {"content": "你负责的工作出现失误，导致其他同事的工作受到影响，你如何处理？", "difficulty": 3, "answer_reference": ""},
            ],
            "应急应变": [
                {"content": "你负责组织的重要活动突然遇到恶劣天气，活动无法按原计划进行，你怎么办？", "difficulty": 3, "answer_reference": ""},
                {"content": "你正在处理群众投诉时，又有新的群众情绪激动地赶来，你如何应对？", "difficulty": 3, "answer_reference": ""},
                {"content": "单位突发网络安全事件，数据面临泄露风险，你作为值班人员如何处理？", "difficulty": 3, "answer_reference": ""},
                {"content": "你在会议上汇报工作时，发现PPT内容有误，你如何处理？", "difficulty": 3, "answer_reference": ""},
                {"content": "领导交办的紧急任务与你手头的重要工作时间冲突，你怎么办？", "difficulty": 3, "answer_reference": ""},
                {"content": "你在基层工作时，遇到群体性事件苗头，你如何处理？", "difficulty": 3, "answer_reference": ""},
                {"content": "单位重要文件丢失，领导让你负责调查处理，你怎么办？", "difficulty": 3, "answer_reference": ""},
                {"content": "你陪同领导视察工作时，群众突然围上来反映问题，你如何应对？", "difficulty": 3, "answer_reference": ""},
            ],
            "组织管理": [
                {"content": "单位让你组织一次'数字政府建设'主题宣传活动，你如何组织？", "difficulty": 3, "answer_reference": ""},
                {"content": "领导要求你组织一次'营商环境优化'专题调研，你会如何开展？", "difficulty": 3, "answer_reference": ""},
                {"content": "请你策划一场'青年干部成长'主题的论坛活动，谈谈你的方案。", "difficulty": 3, "answer_reference": ""},
                {"content": "上级要来检查工作，领导让你负责接待和汇报，你如何准备？", "difficulty": 3, "answer_reference": ""},
                {"content": "如何组织开展'安全生产'相关的培训活动？请谈谈你的思路。", "difficulty": 3, "answer_reference": ""},
                {"content": "请你组织一次单位内部的'业务技能比武'活动，你如何安排？", "difficulty": 3, "answer_reference": ""},
                {"content": "领导让你组织一次'我为群众办实事'实践活动，你如何策划？", "difficulty": 3, "answer_reference": ""},
                {"content": "如何组织开展'党史学习教育'活动？请谈谈你的方案。", "difficulty": 3, "answer_reference": ""},
            ],
            "自我认知": [
                {"content": "请介绍一下你的经历，以及这些经历如何帮助你胜任这个岗位？", "difficulty": 3, "answer_reference": ""},
                {"content": "你认为自己最大的优势是什么？这些优势如何在工作中发挥作用？", "difficulty": 3, "answer_reference": ""},
                {"content": "如果工作中遇到挫折，你会如何调整心态？请结合实例说明。", "difficulty": 3, "answer_reference": ""},
                {"content": "请谈谈你对'为人民服务'的理解，以及你将如何在工作中践行？", "difficulty": 3, "answer_reference": ""},
                {"content": "你为什么选择报考我们单位？你的职业规划是什么？", "difficulty": 3, "answer_reference": ""},
                {"content": "请谈谈你的缺点，以及你如何改进？", "difficulty": 3, "answer_reference": ""},
                {"content": "如果被录用，你如何快速适应新工作环境？", "difficulty": 3, "answer_reference": ""},
                {"content": "请谈谈你在大学期间最有成就感的一件事。", "difficulty": 3, "answer_reference": ""},
            ],
        }

        for cat in self.CATEGORIES:
            self._pool[cat] = mock_pool.get(cat, mock_pool["综合分析"]).copy()
            random.shuffle(self._pool[cat])

    def get_question(
        self,
        category: str = "综合分析",
        exam_type: str = "国考",
        province: str = "",
    ) -> Optional[dict]:
        """从缓存池获取题目（毫秒级响应）"""
        cat = category if category in self.CATEGORIES else "综合分析"

        with self._lock:
            pool = self._pool.get(cat, [])
            if pool:
                question = pool.pop(0)
                question["category"] = cat
                question["exam_type"] = exam_type
                question["province"] = province
                question["status"] = "cached"
                return question

        return None

    def add_question(self, category: str, question: dict):
        """向缓存池添加题目"""
        cat = category if category in self.CATEGORIES else "综合分析"
        with self._lock:
            if cat not in self._pool:
                self._pool[cat] = []
            self._pool[cat].append(question)

    def get_pool_status(self) -> dict:
        """获取缓存池状态"""
        with self._lock:
            return {
                cat: len(self._pool.get(cat, []))
                for cat in self.CATEGORIES
            }

    async def _generate_one(self, category: str, exam_type: str) -> Optional[dict]:
        """异步生成一道题目"""
        try:
            from app.services.search_service import SearchService
            service = SearchService()
            result = await service.generate_question_with_search(category, exam_type)
            return result
        except Exception:
            return None

    async def refresh_pool(self):
        """后台刷新缓存池"""
        if self._refreshing:
            return
        self._refreshing = True

        try:
            for cat in self.CATEGORIES:
                with self._lock:
                    current = len(self._pool.get(cat, []))
                if current >= self.pool_size // 2:
                    continue

                needed = self.pool_size - current
                tasks = [self._generate_one(cat, "国考") for _ in range(min(needed, 3))]
                results = await asyncio.gather(*tasks)

                for result in results:
                    if result:
                        self.add_question(cat, result)

                await asyncio.sleep(1)

            self._last_refresh = time.time()
        finally:
            self._refreshing = False


# 全局单例
_question_pool: Optional[QuestionPool] = None


def get_question_pool() -> QuestionPool:
    """获取题目缓存池单例"""
    global _question_pool
    if _question_pool is None:
        _question_pool = QuestionPool()
    return _question_pool
