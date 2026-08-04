"""AI服务路由"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.models import User
from app.schemas.schemas import (
    TTSRequest,
    ASRRequest,
    ScoreRequest,
    FollowUpQuestionRequest,
)
from app.services.scoring import ScoreService
from app.services.followup import FollowUpService
from app.utils.auth import get_current_user

router = APIRouter()


@router.post("/tts")
async def text_to_speech(
    body: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    """文字转语音"""
    if not settings.TTS_API_KEY or not settings.TTS_API_URL:
        return {
            "audio_url": f"/uploads/tts/mock_{hash(body.text) % 10000}.mp3",
            "duration": len(body.text) * 0.3 / body.speed,
            "status": "mock",
        }

    import httpx
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                settings.TTS_API_URL,
                json={"text": body.text, "speed": body.speed},
                headers={"Authorization": f"Bearer {settings.TTS_API_KEY}"},
                timeout=30.0,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"TTS服务调用失败: {str(e)}",
            )


@router.post("/asr")
async def speech_to_text(
    body: ASRRequest,
    current_user: User = Depends(get_current_user),
):
    """语音转文字（优先使用FunASR离线识别，fallback到Vosk）"""
    import httpx
    from pathlib import Path

    # 优先使用 FunASR 离线语音识别（完全免费、中文识别率高、支持多格式）
    if body.audio_url:
        try:
            text = await _funasr_asr(body.audio_url)
            if text:
                return {
                    "text": text,
                    "confidence": 0.95,
                    "duration": body.audio_duration or 60.0,
                    "audio_url": body.audio_url,
                    "status": "funasr",
                }
        except Exception as e:
            print(f"FunASR语音识别失败: {e}")

    # Fallback: Vosk 离线语音识别（免费、无需API Key，支持WAV格式）
    if body.audio_url:
        try:
            text = await _vosk_asr(body.audio_url)
            if text:
                return {
                    "text": text,
                    "confidence": 0.90,
                    "duration": body.audio_duration or 60.0,
                    "audio_url": body.audio_url,
                    "status": "vosk",
                }
        except Exception as e:
            print(f"Vosk语音识别失败: {e}")

    # 使用百度语音识别（国内速度快，每天5万次免费额度）
    if settings.BAIDU_API_KEY and settings.BAIDU_SECRET_KEY and body.audio_url:
        try:
            text = await _baidu_asr(body.audio_url)
            if text:
                return {
                    "text": text,
                    "confidence": 0.95,
                    "duration": body.audio_duration or 60.0,
                    "audio_url": body.audio_url,
                    "status": "baidu",
                }
        except Exception as e:
            print(f"百度语音识别失败: {e}")

    # 使用讯飞语音识别
    if settings.XFYUN_APP_ID and settings.XFYUN_API_KEY and settings.XFYUN_API_SECRET and body.audio_url:
        try:
            text = await _xfyun_asr(body.audio_url)
            if text:
                return {
                    "text": text,
                    "confidence": 0.95,
                    "duration": body.audio_duration or 60.0,
                    "audio_url": body.audio_url,
                    "status": "xfyun",
                }
        except Exception as e:
            print(f"讯飞语音识别失败: {e}")

    # 使用豆包ASR API
    if settings.DOUBAO_API_KEY and body.audio_url:
        async with httpx.AsyncClient() as client:
            try:
                audio_resp = await client.get(body.audio_url, timeout=30.0)
                audio_content = audio_resp.content

                import base64
                audio_b64 = base64.b64encode(audio_content).decode("utf-8")

                resp = await client.post(
                    "https://api.doubao.com/v1/audio/transcriptions",
                    json={
                        "model": "whisper-1",
                        "audio": audio_b64,
                        "language": "zh",
                        "response_format": "json",
                    },
                    headers={"Authorization": f"Bearer {settings.DOUBAO_API_KEY}"},
                    timeout=60.0,
                )
                resp.raise_for_status()
                data = resp.json()
                if "text" in data:
                    return {
                        "text": data["text"],
                        "confidence": data.get("confidence", 0.90),
                        "duration": body.audio_duration or 60.0,
                        "audio_url": body.audio_url,
                        "status": "doubao",
                    }
            except httpx.HTTPError as e:
                pass

    # 通用ASR API
    if settings.ASR_API_KEY and settings.ASR_API_URL:
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    settings.ASR_API_URL,
                    json={"audio_url": body.audio_url, "audio_duration": body.audio_duration},
                    headers={"Authorization": f"Bearer {settings.ASR_API_KEY}"},
                    timeout=60.0,
                )
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"ASR服务调用失败: {str(e)}",
                )

    # Mock 模式：返回提示用户配置API的信息
    return {
        "text": "（语音识别结果 - FunASR模型加载失败，请检查模型依赖或联系管理员）",
        "confidence": 0.95,
        "duration": body.audio_duration or 60.0,
        "audio_url": body.audio_url,
        "status": "mock",
    }


_vosk_model = None


def _get_vosk_model():
    """懒加载 Vosk 中文模型"""
    global _vosk_model
    if _vosk_model is None:
        import os
        model_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "models",
            "vosk-model-small-cn-0.22",
        )
        if not os.path.exists(model_path):
            return None
        from vosk import Model
        _vosk_model = Model(model_path)
    return _vosk_model


async def _vosk_asr(audio_url: str) -> str:
    """Vosk 离线语音识别（免费、无需API Key）"""
    import json
    import os
    import tempfile
    import wave

    import httpx

    model = _get_vosk_model()
    if model is None:
        return ""

    # 获取音频数据：支持本地路径和完整URL
    if audio_url.startswith("/uploads/"):
        # 本地文件，直接读取
        local_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            audio_url.lstrip("/"),
        )
        with open(local_path, "rb") as f:
            audio_data = f.read()
    else:
        # 完整URL，用httpx下载
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url, timeout=30.0)
            audio_data = resp.content

    # 保存到临时文件
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_data)
        tmp_path = tmp.name

    try:
        wf = wave.open(tmp_path, "rb")
        from vosk import KaldiRecognizer

        rec = KaldiRecognizer(model, wf.getframerate())
        text = ""
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                text += result.get("text", "")
        final = json.loads(rec.FinalResult())
        text += final.get("text", "")
        wf.close()
        return text
    finally:
        os.unlink(tmp_path)


_funasr_model = None


def _get_funasr_model():
    """懒加载 FunASR SenseVoice 轻量模型（完全离线，无需网络）"""
    global _funasr_model
    if _funasr_model is None:
        try:
            from funasr import AutoModel
            # 使用阿里 SenseVoiceSmall 轻量模型，参数量小，推理快
            _funasr_model = AutoModel(
                model="iic/SenseVoiceSmall",
                vad_model="fsmn-vad",
                punc_model="ct-punc-c",
                device="cpu",
                disable_pbar=True,
                disable_log=True,
            )
            print("[FunASR SenseVoice] 模型加载成功")
        except Exception as e:
            print(f"[FunASR SenseVoice] 模型加载失败: {e}")
            return None
    return _funasr_model


async def _funasr_asr(audio_url: str) -> str:
    """FunASR SenseVoice 离线语音识别（支持wav/webm/mp3等常见格式）"""
    import asyncio
    import os
    import tempfile

    import httpx

    model = _get_funasr_model()
    if model is None:
        return ""

    # 获取音频数据
    if audio_url.startswith("/uploads/"):
        local_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            audio_url.lstrip("/"),
        )
        audio_path = local_path
    else:
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url, timeout=30.0)
            audio_data = resp.content
        ext = os.path.splitext(audio_url)[1] or ".wav"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_data)
            audio_path = tmp.name

    try:
        # FunASR 是同步推理，放到线程池执行避免阻塞事件循环
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: model.generate(input=audio_path, batch_size_s=300))

        if result and len(result) > 0:
            text = result[0].get("text", "")
            return text.strip()
        return ""
    finally:
        # 只删除我们创建的临时文件
        if not audio_url.startswith("/uploads/") and os.path.exists(audio_path):
            os.unlink(audio_path)


_baidu_token = None
_baidu_token_expire = 0


async def _get_baidu_token() -> str:
    """获取百度语音识别 access_token（缓存30天）"""
    global _baidu_token, _baidu_token_expire
    import time

    if _baidu_token and _baidu_token_expire > time.time():
        return _baidu_token

    import httpx

    url = "https://aip.baidubce.com/oauth/2.0/token"
    params = {
        "grant_type": "client_credentials",
        "client_id": settings.BAIDU_API_KEY,
        "client_secret": settings.BAIDU_SECRET_KEY,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, params=params, timeout=10.0)
        data = resp.json()
        _baidu_token = data.get("access_token", "")
        _baidu_token_expire = time.time() + data.get("expires_in", 2592000) - 300
        return _baidu_token


async def _baidu_asr(audio_url: str) -> str:
    """百度语音识别（支持wav/pcm/amr/m4a格式，采样率16000）"""
    import base64
    import json
    import os

    import httpx

    # 检查音频格式是否支持
    ext = os.path.splitext(audio_url)[1].lower().lstrip(".")
    # 百度支持的格式: wav, pcm, amr, m4a
    if ext not in ("wav", "pcm", "amr", "m4a"):
        print(f"百度语音识别: 不支持的格式 '{ext}', 跳过")
        return ""

    token = await _get_baidu_token()
    if not token:
        return ""

    # 读取音频数据
    if audio_url.startswith("/uploads/"):
        local_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            audio_url.lstrip("/"),
        )
        with open(local_path, "rb") as f:
            audio_data = f.read()
    else:
        async with httpx.AsyncClient() as client:
            resp = await client.get(audio_url, timeout=30.0)
            audio_data = resp.content

    audio_b64 = base64.b64encode(audio_data).decode("utf-8")

    url = f"https://vop.baidu.com/server_api?dev_pid=1537&cuid=gongkaoxing&token={token}"
    payload = {
        "format": ext,
        "rate": 16000,
        "channel": 1,
        "cuid": "gongkaoxing",
        "speech": audio_b64,
        "len": len(audio_data),
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30.0,
        )
        result = resp.json()
        if result.get("err_no") == 0:
            return result.get("result", [""])[0]
        else:
            print(f"百度语音识别错误: {result}")
            return ""


async def _xfyun_asr(audio_url: str) -> str:
    """讯飞语音识别（一句话识别REST API）"""
    import base64
    import hashlib
    import hmac
    import json
    import time
    from datetime import datetime
    from urllib.parse import urlencode

    import httpx

    audio_resp = await httpx.AsyncClient().get(audio_url, timeout=30.0)
    audio_content = audio_resp.content

    audio_b64 = base64.b64encode(audio_content).decode("utf-8")

    # 讯飞一句话识别 API
    url = "https://api.xfyun.cn/v1/service/v1/iat"

    # 生成鉴权参数
    cur_time = str(int(time.time()))
    param = {
        "engine_type": "sms16k",
        "aue": "raw",
    }
    param_b64 = base64.b64encode(json.dumps(param).encode("utf-8")).decode("utf-8")

    check_sum_origin = settings.XFYUN_API_SECRET + cur_time + param_b64
    check_sum = hashlib.sha1(check_sum_origin.encode("utf-8")).hexdigest()

    headers = {
        "X-Appid": settings.XFYUN_APP_ID,
        "X-CurTime": cur_time,
        "X-Param": param_b64,
        "X-CheckSum": check_sum,
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
    }

    data = {
        "audio": audio_b64,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=headers, data=data, timeout=30.0)
        result = resp.json()
        if result.get("code") == "0" and "data" in result:
            return result["data"]
        else:
            print(f"讯飞ASR返回错误: {result}")
            return ""


@router.post("/score")
async def score_answer(
    body: ScoreRequest,
    current_user: User = Depends(get_current_user),
):
    """AI五维评分"""
    service = ScoreService()
    result = await service.score(
        question_content=body.question_content,
        answer_text=body.answer_text,
        question_category=body.question_category,
    )
    return result


@router.post("/follow-up")
async def generate_follow_up(
    body: FollowUpQuestionRequest,
    current_user: User = Depends(get_current_user),
):
    """AI生成追问"""
    if body.round_number > settings.MAX_FOLLOW_UP_PER_SESSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"追问轮次不能超过{settings.MAX_FOLLOW_UP_PER_SESSION}轮",
        )

    service = FollowUpService()
    result = await service.generate(
        question_content=body.question_content,
        answer_text=body.answer_text,
        question_category=body.question_category,
        round_number=body.round_number,
    )
    return result


@router.post("/generate-question")
async def generate_question(
    category: str = "综合分析",
    exam_type: str = "国考",
    province: str = "",
    random_category: bool = False,
    use_search: bool = True,
    current_user: User = Depends(get_current_user),
):
    """
    出题流程（纯本地，无联网）：
    1. 本地真题库随机抽取（核心） → 2. 内置题库兜底
    全流程去重检测
    """
    import random

    from app.services.dedup import get_deduplicator
    from app.services.real_questions import get_real_question_service

    categories = ["综合分析", "人际沟通", "应急应变", "组织管理", "自我认知"]

    if random_category:
        category = random.choice(categories)

    dedup = get_deduplicator()

    # ========== 1. 本地真题库随机抽取（核心） ==========
    service = get_real_question_service()
    for attempt in range(3):
        result = service.get_question(category, exam_type, province)
        if result and not dedup.is_duplicate(result["content"]):
            dedup.add_question(result["content"])
            print(f"[出题] 本地真题库命中，category={category}，attempt={attempt+1}")
            return result
        # 去重命中，换分类重试
        remaining = [c for c in categories if c != category]
        if remaining:
            category = random.choice(remaining)

    # ========== 2. 兜底：内置题库 ==========
    print(f"[出题] 真题库耗尽或去重命中，走内置题库兜底 category={category}")
    return _fallback_question(category, exam_type, province, dedup)


def _fallback_question(
    category: str,
    exam_type: str,
    province: str,
    dedup,
) -> dict:
    """兜底：内置丰富题库随机选题"""
    import random
    from app.services.real_questions import get_real_question_service

    service = get_real_question_service()
    fallback = service.get_question(category, exam_type, province)

    if fallback and not dedup.is_duplicate(fallback["content"]):
        dedup.add_question(fallback["content"])
        return fallback

    # 扩大兜底题库：每类6道，耗尽后跨类别选题，确保 10 题内不重复
    mock_pool = {
        "综合分析": [
            "请谈谈你对当前经济高质量发展的理解，结合实际分析其重要意义和实现路径。",
            "数字经济已成为推动社会发展的重要引擎，请分析其面临的挑战及应对策略。",
            "乡村振兴是国家重大战略，请结合实际谈谈如何推进农村产业发展。",
            "有人说基层治理是国家治理的基石，请谈谈你对这句话的看法。",
            "当前社会上出现了一些躺平现象，请结合岗位谈谈你的认识。",
            "共同富裕是社会主义的本质要求，请说说你的理解。",
        ],
        "人际沟通": [
            "你在工作中遇到同事不配合的情况，你如何处理？",
            "领导安排你与同事合作，但对方态度消极，你怎么办？",
            "你发现领导在工作中出现了失误，你会怎么处理？",
            "群众到单位办事但不符合规定要求，情绪很激动，你怎么办？",
            "与你有矛盾的同事被提拔为你的上级，你如何和他相处？",
            "你安排的任务下属拒不执行，你会如何处理？",
        ],
        "应急应变": [
            "你负责的活动即将开始时出现意外情况，你如何应对？",
            "值班时接到紧急通知需要立即处理，你怎么办？",
            "你单位组织的会议现场突然停电，你如何处置？",
            "政务服务网突然宕机，大量办事群众聚集投诉，你怎么处理？",
            "你陪同上级考察途中车辆发生剐蹭，对方司机要求赔偿，你怎么办？",
            "你正在接待群众来访，突然接到家人电话说有急事，你怎么办？",
        ],
        "组织管理": [
            "领导安排你组织一次业务培训，你如何开展？",
            "请谈谈你组织一次调研活动的工作思路。",
            "单位让你组织一场党史学习教育主题活动，你怎么做？",
            "上级要求你单位开展营商环境大走访，你如何安排？",
            "领导让你负责新公务员入职培训工作，你怎么组织？",
            "社区要组织一次反诈宣传活动，请你设计方案。",
        ],
        "自我认知": [
            "请结合实际谈谈你的职业规划。",
            "你认为报考这个岗位的优势是什么？",
            "请说说你的缺点，以及你准备如何改进。",
            "如果入职后发现工作内容和你预期的差别很大，你怎么办？",
            "工作中你遇到的最大挫折是什么？你是如何克服的？",
            "请结合你报考的岗位，谈谈对\"全心全意为人民服务\"的理解。",
        ],
    }

    # 1. 优先用指定分类下未用过的题
    questions = mock_pool.get(category, mock_pool["综合分析"])
    unused = [q for q in questions if not dedup.is_duplicate(q)]
    if unused:
        q = random.choice(unused)
        dedup.add_question(q)
        return {
            "content": q,
            "difficulty": 3,
            "answer_reference": "（请结合实际情况，分3-4个要点作答）",
            "category": category,
            "exam_type": exam_type,
            "province": province,
            "source": "内置题库",
            "status": "fallback",
        }

    # 2. 指定分类用完了，跨所有分类找一道未用过的
    all_unused = [
        (cat, q)
        for cat, qs in mock_pool.items()
        for q in qs
        if not dedup.is_duplicate(q)
    ]
    if all_unused:
        cat, q = random.choice(all_unused)
        dedup.add_question(q)
        return {
            "content": q,
            "difficulty": 3,
            "answer_reference": "（请结合实际情况，分3-4个要点作答）",
            "category": cat,
            "exam_type": exam_type,
            "province": province,
            "source": "内置题库",
            "status": "fallback-cross",
        }

    # 3. 全部用完，才真随机（概率极低，只有一天刷 30+ 题才会触发）
    cat = random.choice(list(mock_pool.keys()))
    q = random.choice(mock_pool[cat])
    return {
        "content": q,
        "difficulty": 3,
        "answer_reference": "（请结合实际情况，分3-4个要点作答）",
        "category": cat,
        "exam_type": exam_type,
        "province": province,
        "source": "内置题库",
        "status": "fallback-random",
    }
