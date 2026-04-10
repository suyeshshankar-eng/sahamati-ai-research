import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: "/chat", label: "Chat" },
    { path: "/documents", label: "Documents" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-full mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/chat" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Sahamati" className="h-7" />
              <span className="text-sm font-semibold text-gray-900 hidden sm:inline">AI Research</span>
            </a>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname.startsWith(item.path)
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              {user.pictureUrl && (
                <img
                  src={user.pictureUrl}
                  alt=""
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-sm text-gray-600 hidden sm:inline">
                {user.name ?? user.email}
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
