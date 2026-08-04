import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LogOut, User, ChevronRight } from 'lucide-react'

export function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#000000] text-[#F0F0FA]">
      <header className="border-b border-[rgba(240,240,250,0.35)] bg-black/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl tracking-[0.15em]">
            VERINX
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-xs uppercase-spacex text-[rgba(240,240,250,0.7)]" />
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 text-xs uppercase-spacex text-[rgba(240,240,250,0.7)] hover:text-[#F0F0FA] transition-spacex">
                  <User className="w-4 h-4" />
                  {user?.name || user?.phone || 'PROFILE'}
                </Link>
                {user?.member_type === 'free' && (
                  <Link to="/membership" className="text-xs uppercase-spacex border border-[rgba(240,240,250,0.35)] px-4 py-2 hover:bg-[rgba(240,240,250,0.1)] transition-spacex">
                    开通会员
                  </Link>
                )}
                <button onClick={handleLogout} className="text-[rgba(240,240,250,0.7)] hover:text-[#F0F0FA] transition-spacex">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link to="/login" className="text-xs uppercase-spacex border border-[rgba(240,240,250,0.35)] px-5 py-2 hover:bg-[rgba(240,240,250,0.1)] transition-spacex">
                登录
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-[rgba(240,240,250,0.35)] py-6 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[#808080]">
          <p className="uppercase-spacex tracking-[0.1em]">AI评分仅作为备考练习参考，不等同考场考官打分</p>
          <p className="uppercase-spacex tracking-[0.1em]">© 2026 VERINX</p>
        </div>
      </footer>
    </div>
  )
}
