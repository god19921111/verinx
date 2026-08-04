import axios from 'axios'

// 支持通过环境变量配置后端地址（Vercel部署时使用）
// 本地开发：'/api'（由 Vite 代理转发到 http://localhost:8000）
// 生产部署：通过 VITE_API_BASE_URL 指向后端域名，如 'https://verinx-api.onrender.com/api'
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器：自动附加Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 或 403：未授权或禁止访问，清除Token跳转登录
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // 断网或服务器不可达
    if (!error.response) {
      if (error.code === 'ERR_NETWORK') {
        error.message = '网络连接已断开，请检查网络后重试'
      } else if (error.code === 'ECONNABORTED') {
        error.message = '请求超时，请稍后重试'
      }
    }

    return Promise.reject(error)
  },
)

export const uploadAudio = async (blob: Blob): Promise<string> => {
  const formData = new FormData()
  formData.append('file', blob, `recording_${Date.now()}.wav`)
  const res = await api.post('/upload/audio', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 上传音频：2分钟
  })
  const data = res.data.data || res.data
  return data.url || ''
}

export const recognizeSpeech = async (audioUrl: string): Promise<string> => {
  const res = await api.post('/ai/asr', { audio_url: audioUrl }, {
    timeout: 180000, // 语音识别：3分钟（首次加载FunASR模型较慢）
  })
  const data = res.data.data || res.data
  return data.text || ''
}

export default api
