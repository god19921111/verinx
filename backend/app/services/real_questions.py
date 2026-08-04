"""真实公考真题数据源服务 - 基于历年真题数据库，支持增量云端更新"""

import json
import random
from datetime import datetime
from pathlib import Path
from typing import Optional


class RealQuestionService:
    """真实真题数据源 - 本地优先 + 增量云端更新"""

    def __init__(self):
        self._questions: dict[str, list[dict]] = {}
        self._used_hashes: set[str] = set()
        self._json_path = Path(__file__).parent / "real_questions.json"
        self._last_sync_file = Path(__file__).parent / ".last_sync"
        self._load_questions()

    def _sync_from_cloud(self) -> dict:
        """
        静默从云端同步增量真题。
        联网时自动下载新题并合并到本地 JSON，无网络或失败时不报错。
        """
        from app.config import settings

        cloud_url = settings.QUESTION_BANK_CLOUD_URL
        if not cloud_url:
            return {"synced": False, "reason": "无云端题库配置"}

        # 检查同步间隔
        try:
            import time
            if self._last_sync_file.exists():
                last_sync = float(self._last_sync_file.read_text().strip())
                elapsed_hours = (time.time() - last_sync) / 3600
                if elapsed_hours < settings.QUESTION_BANK_SYNC_INTERVAL_HOURS:
                    return {"synced": False, "reason": f"距离上次同步仅 {elapsed_hours:.1f} 小时"}
        except Exception:
            pass

        try:
            import httpx

            with httpx.Client(timeout=15.0) as client:
                resp = client.get(cloud_url)
                resp.raise_for_status()
                cloud_data = resp.json()

            if not isinstance(cloud_data, dict):
                return {"synced": False, "reason": "云端数据格式错误"}

            added = 0
            for category, new_questions in cloud_data.items():
                if not isinstance(new_questions, list):
                    continue
                existing_contents = {
                    self._hash_content(q.get("content", ""))
                    for q in self._questions.get(category, [])
                }
                for item in new_questions:
                    content = item.get("content", "")
                    if not content:
                        continue
                    h = self._hash_content(content)
                    if h not in existing_contents:
                        self._questions.setdefault(category, []).append(item)
                        existing_contents.add(h)
                        added += 1

            if added > 0:
                self._save_questions()

            # 更新时间戳
            try:
                self._last_sync_file.write_text(str(time.time()))
            except Exception:
                pass

            return {"synced": True, "added": added}

        except httpx.HTTPError as e:
            return {"synced": False, "reason": f"网络请求失败: {e}"}
        except Exception as e:
            return {"synced": False, "reason": f"同步异常: {e}"}

    def _save_questions(self):
        """保存题库到本地 JSON"""
        try:
            with open(self._json_path, "w", encoding="utf-8") as f:
                json.dump(self._questions, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[题库保存] 失败: {e}")

    def try_sync(self) -> dict:
        """供外部调用的同步入口"""
        return self._sync_from_cloud()

    def _load_questions(self):
        """加载真题数据库"""
        if self._json_path.exists():
            with open(self._json_path, "r", encoding="utf-8") as f:
                self._questions = json.load(f)

    def get_question(
        self,
        category: str = "综合分析",
        exam_type: str = "国考",
        province: str = "",
        exclude_contents: Optional[list[str]] = None,
    ) -> Optional[dict]:
        """
        从真实题库获取一道题目
        优先返回近年（2024年）真题，再按年份降级
        """
        pool = self._questions.get(category, [])
        if not pool:
            return None

        if exclude_contents is None:
            exclude_contents = []

        # 按优先级排序：最新年份优先，国考/省考优先
        now = datetime.now().year

        def score_item(item: dict) -> tuple:
            year = item.get("year", 2020)
            source = item.get("source", "")
            # 国考优先 > 省考 > 事业单位
            type_score = 0
            if "国考" in source:
                type_score = 3
            elif "省考" in source:
                type_score = 2
            elif "事业单位" in source:
                type_score = 1
            # 年份越近越好
            year_score = year - 2020
            return (type_score, year_score)

        sorted_pool = sorted(pool, key=score_item, reverse=True)

        # 过滤已使用或排除的题目
        available = []
        for item in sorted_pool:
            content = item["content"]
            content_hash = self._hash_content(content)
            if content_hash in self._used_hashes:
                continue
            if any(self._similar(content, ec) for ec in exclude_contents):
                continue
            available.append(item)

        if not available:
            # 所有真题都用过了，重置使用记录，并且直接 true random 避免权重偏向同一道
            self._used_hashes.clear()
            available = list(sorted_pool)
            random.shuffle(available)

        if not available:
            return None

        # 真随机：避免按权重排序导致每次返回同一道"国考优先"的题
        chosen = random.choice(available)

        self._used_hashes.add(self._hash_content(chosen["content"]))

        return {
            "content": chosen["content"],
            "difficulty": chosen.get("difficulty", 3),
            "answer_reference": self._generate_reference(chosen, category),
            "category": category,
            "exam_type": exam_type,
            "province": province,
            "source": chosen.get("source", "真题"),
            "year": chosen.get("year", now),
            "status": "real",
        }

    def _generate_reference(self, item: dict, category: str) -> str:
        """根据题目分类生成参考答案框架"""
        difficulty = item.get("difficulty", 3)

        if category == "综合分析":
            return (
                "【答题框架】\n"
                "1. 表态：亮明观点/态度，点明本质\n"
                "2. 分析：从多角度分析（原因、影响、意义）\n"
                "3. 对策：提出切实可行的解决方案\n"
                "4. 升华：联系实际，展望未来"
            )
        elif category == "人际沟通":
            return (
                "【答题框架】\n"
                "1. 冷静：保持理性，避免情绪化\n"
                "2. 沟通：主动沟通，了解对方诉求\n"
                "3. 协调：寻求共识，推动问题解决\n"
                "4. 反思：总结经验，避免类似问题"
            )
        elif category == "应急应变":
            return (
                "【答题框架】\n"
                "1. 紧急处置：第一时间控制局面\n"
                "2. 调查核实：了解事件全貌\n"
                "3. 妥善处理：分情况解决问题\n"
                "4. 善后改进：总结反思，完善预案"
            )
        elif category == "组织管理":
            return (
                "【答题框架】\n"
                "1. 明确目标：了解活动目的和要求\n"
                "2. 制定计划：详细规划各环节\n"
                "3. 组织实施：协调资源，推进执行\n"
                "4. 总结评估：总结经验，持续改进"
            )
        elif category == "自我认知":
            return (
                "【答题框架】\n"
                "1. 自我剖析：客观分析自身情况\n"
                "2. 岗位匹配：结合岗位需求阐述优势\n"
                "3. 发展规划：明确短期和长期目标\n"
                "4. 表态升华：表达决心和信心"
            )
        return "【答题框架】请结合实际情况，条理清晰地作答。"

    def _hash_content(self, content: str) -> str:
        import hashlib
        normalized = "".join(c for c in content.lower() if c.isalnum() or '\u4e00' <= c <= '\u9fff')
        return hashlib.md5(normalized.encode("utf-8")).hexdigest()

    def _similar(self, text1: str, text2: str) -> bool:
        """快速相似度检测"""
        if not text2:
            return False
        # 简化相似度：比较核心关键词重叠率
        set1 = set(text1)
        set2 = set(text2)
        intersection = set1 & set2
        union = set1 | set2
        if not union:
            return False
        jaccard = len(intersection) / len(union)
        return jaccard > 0.7

    def get_stats(self) -> dict:
        """获取题库统计"""
        total = sum(len(questions) for questions in self._questions.values())
        return {
            "total_questions": total,
            "categories": {
                cat: len(qs)
                for cat, qs in self._questions.items()
            },
            "used_count": len(self._used_hashes),
        }


# 全局实例
_real_service: Optional[RealQuestionService] = None


def get_real_question_service() -> RealQuestionService:
    """获取真实题库服务"""
    global _real_service
    if _real_service is None:
        _real_service = RealQuestionService()
    return _real_service
