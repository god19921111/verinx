"""题目去重工具 - MD5哈希 + 文本相似度检测"""

import hashlib
import re
from typing import Optional


def normalize_text(text: str) -> str:
    """标准化文本：去除标点、空格、统一格式"""
    text = text.lower().strip()
    text = re.sub(r'[^\u4e00-\u9fa5a-z0-9]', '', text)
    text = re.sub(r'\s+', '', text)
    return text


def compute_hash(text: str) -> str:
    """计算文本MD5哈希"""
    normalized = normalize_text(text)
    return hashlib.md5(normalized.encode('utf-8')).hexdigest()


def compute_similarity(text1: str, text2: str) -> float:
    """计算两段文本的相似度（基于字符级编辑距离的简化版）"""
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)

    if not norm1 or not norm2:
        return 0.0

    if norm1 == norm2:
        return 1.0

    len1, len2 = len(norm1), len(norm2)
    max_len = max(len1, len2)

    # 使用最长公共子序列的简化近似
    # 通过滑动窗口比较共同子串
    matches = 0
    min_len = min(len1, len2)
    window_size = max(1, min_len // 5)

    for i in range(len(norm1) - window_size + 1):
        window = norm1[i:i + window_size]
        if window in norm2:
            matches += 1

    # 基于共同窗口的相似度
    similarity = matches / max(len1 - window_size + 1, len2 - window_size + 1)

    # 如果长度差距太大，降低相似度
    ratio = min(len1, len2) / max(len1, len2)
    if ratio < 0.5:
        similarity *= ratio

    return min(similarity * 1.5, 1.0)


class QuestionDeduplicator:
    """题目去重管理器"""

    def __init__(self, similarity_threshold: float = 0.75):
        self._hashes: set[str] = set()
        self._contents: list[str] = []
        self._similarity_threshold = similarity_threshold

    def add_question(self, content: str) -> bool:
        """
        添加题目，判断是否重复
        返回: True 表示添加成功（非重复），False 表示重复
        """
        content = content.strip()
        if not content:
            return False

        # 1. MD5 精确匹配
        h = compute_hash(content)
        if h in self._hashes:
            return False

        # 2. 相似度检测（与已有题目比较）
        for existing in self._contents:
            sim = compute_similarity(content, existing)
            if sim >= self._similarity_threshold:
                return False

        # 非重复，添加
        self._hashes.add(h)
        self._contents.append(content)
        return True

    def is_duplicate(self, content: str) -> bool:
        """检查题目是否重复"""
        content = content.strip()
        if not content:
            return False

        h = compute_hash(content)
        if h in self._hashes:
            return True

        for existing in self._contents:
            sim = compute_similarity(content, existing)
            if sim >= self._similarity_threshold:
                return True

        return False

    def get_stats(self) -> dict:
        """获取去重统计"""
        return {
            "total_stored": len(self._contents),
            "unique_hashes": len(self._hashes),
            "similarity_threshold": self._similarity_threshold,
        }

    def reset(self):
        """重置去重器"""
        self._hashes.clear()
        self._contents.clear()


# 全局去重器实例
_deduplicator: Optional[QuestionDeduplicator] = None


def get_deduplicator() -> QuestionDeduplicator:
    """获取全局去重器"""
    global _deduplicator
    if _deduplicator is None:
        _deduplicator = QuestionDeduplicator()
    return _deduplicator
