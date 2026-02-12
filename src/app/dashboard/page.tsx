"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/components/ui";
import { ROUTES } from "@/constants";
import { dashboardService } from "@/services/dashboardService";
import { authService } from "@/services/authService";
import { useFavoritesStore } from "@/store";
import type { Dashboard, User } from "@/types";

type FilterType = "all" | "my_dashboards" | "shared" | "private" | "workspace";

export default function DashboardPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ dashboardId: number } | null>(null);
  const [dashboardMemberIds, setDashboardMemberIds] = useState<Record<number, number[]>>({});
  const [creating, setCreating] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { favorites, addFavorite, removeFavorite } = useFavoritesStore();

  function isDashboardFav(id: number) {
    return favorites.some((f) => f.type === "dashboard" && f.id === id);
  }
  function toggleDashboardFav(e: React.MouseEvent, d: Dashboard) {
    e.stopPropagation();
    if (isDashboardFav(d.id)) removeFavorite("dashboard", d.id);
    else addFavorite({ type: "dashboard", id: d.id, name: d.name });
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [dashboardsData, userData] = await Promise.all([
        dashboardService.list(),
        authService.me().catch(() => null),
      ]);
      setDashboards(dashboardsData);
      setCurrentUser(userData);
      const membersMap: Record<number, number[]> = {};
      for (const d of dashboardsData) {
        try {
          const share = await dashboardService.getSharing(d.id);
          membersMap[d.id] = share.members.filter((m) => m.user_id !== d.owner_id).map((m) => m.user_id);
        } catch {
          membersMap[d.id] = [];
        }
      }
      setDashboardMemberIds(membersMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getRecentDashboards() {
    return [...dashboards]
      .sort((a, b) => {
        const dateA = new Date(a.last_viewed_at || a.updated_at).getTime();
        const dateB = new Date(b.last_viewed_at || b.updated_at).getTime();
        return dateB - dateA;
      })
      .slice(0, 3);
  }

  function getMyDashboards() {
    if (!currentUser) return [];
    return dashboards.filter((d) => d.owner_id === currentUser.id);
  }

  function getFilteredDashboards() {
    let filtered = dashboards;
    if (filter === "my_dashboards") filtered = filtered.filter((d) => d.owner_id === currentUser?.id);
    else if (filter === "private") filtered = filtered.filter((d) => d.owner_id === currentUser?.id);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) => d.name.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q))
      );
    }
    return filtered;
  }

  async function handleNewDashboard() {
    setCreating(true);
    try {
      const created = await dashboardService.create({ name: "Dashboard" });
      await loadData();
      router.push(ROUTES.DASHBOARD_DETAIL(created.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create dashboard");
    } finally {
      setCreating(false);
    }
  }

  function formatDate(date: string | null): string {
    if (!date) return "-";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function getUserInitials(userId: number): string {
    // If it's current user, use their name/email
    if (currentUser && userId === currentUser.id) {
      const name = currentUser.name || currentUser.email;
      const parts = name.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    // For other users, return placeholder (could be enhanced with user lookup)
    return "U";
  }

  const recentDashboards = getRecentDashboards();
  const myDashboards = getMyDashboards();
  const filteredDashboards = getFilteredDashboards();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent, dashboard: Dashboard) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ dashboardId: dashboard.id });
  }

  function handleShareClick(dashboard: Dashboard) {
    setSelectedDashboard(dashboard);
    setShowShareModal(true);
    setContextMenu(null);
  }

  function handleCopyLink(dashboard: Dashboard) {
    const url = `${window.location.origin}${ROUTES.DASHBOARD_DETAIL(dashboard.id)}`;
    navigator.clipboard.writeText(url);
    setContextMenu(null);
  }

  function handleRename(dashboard: Dashboard) {
    const name = prompt("Rename dashboard", dashboard.name);
    if (name != null && name.trim()) {
      dashboardService.update(dashboard.id, { name: name.trim() }).then(() => loadData());
    }
    setContextMenu(null);
  }

  function handleDuplicate(dashboard: Dashboard) {
    dashboardService.create({ name: `${dashboard.name} (Copy)`, description: dashboard.description ?? undefined }).then(() => loadData());
    setContextMenu(null);
  }

  function handleDelete(dashboard: Dashboard) {
    if (confirm(`Are you sure you want to delete "${dashboard.name}"?`)) {
      dashboardService.delete(dashboard.id).then(() => loadData());
    }
    setContextMenu(null);
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Dashboards</h1>
        <div className="flex items-center gap-4">
          <Input
            type="text"
            placeholder="Search Dashboards"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 bg-white/80"
          />
          <Button variant="primary" onClick={handleNewDashboard} disabled={creating}>
            {creating ? "Creating…" : "+ New Dashboard"}
          </Button>
          <Link href={ROUTES.PROJECTS}>
            <Button variant="secondary">Projects</Button>
          </Link>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Recent */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent</h3>
          <div className="space-y-2">
            {recentDashboards.length > 0 ? (
              recentDashboards.map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={ROUTES.DASHBOARD_DETAIL(dashboard.id)}
                  className="block p-2 hover:bg-white/60 rounded-lg transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-800 font-medium">{dashboard.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-5 h-5 flex items-center justify-center">
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">No recent dashboards</p>
            )}
          </div>
        </Card>

        {/* Favorites */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Favorites</h3>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <p className="text-sm text-slate-500">Your favorited Dashboards will show here</p>
            </div>
          </div>
        </Card>

        {/* Created by Me */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Created by Me</h3>
          <div className="space-y-2">
            {myDashboards.length > 0 ? (
              myDashboards.slice(0, 3).map((dashboard) => (
                <Link
                  key={dashboard.id}
                  href={ROUTES.DASHBOARD_DETAIL(dashboard.id)}
                  className="block p-2 hover:bg-white/60 rounded-lg transition-colors"
                >
                  <span className="text-sm text-slate-800 font-medium">{dashboard.name}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500">No dashboards created by you</p>
            )}
          </div>
        </Card>
      </div>

      {/* All Projects Table */}
      <Card className="p-0 overflow-hidden">
        {/* Filter Tabs */}
        <div className="border-b border-white/30 px-6">
          <div className="flex items-center gap-1">
            {(["all", "my_dashboards", "shared", "private", "workspace"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  filter === f ? "border-violet-600 text-violet-700" : "border-transparent text-slate-600 hover:text-slate-800"
                }`}
              >
                {f === "all" ? "All" : f === "my_dashboards" ? "My Dashboards" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/50 border-b border-white/30">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Name</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Location</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:text-slate-900">
                  <div className="flex items-center gap-1">
                    Date viewed
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Date updated</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Owner</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    Sharing
                    <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody>
              {filteredDashboards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {searchQuery ? "No dashboards found" : "No dashboards yet. Click New Dashboard to create one."}
                  </td>
                </tr>
              ) : (
                filteredDashboards.map((dashboard) => (
                  <tr
                    key={dashboard.id}
                    className="border-b border-white/20 hover:bg-white/40 transition-colors cursor-pointer"
                    onClick={() => router.push(ROUTES.DASHBOARD_DETAIL(dashboard.id))}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => toggleDashboardFav(e, dashboard)}
                          className="shrink-0 p-0.5 rounded text-slate-400 hover:text-amber-500 focus:outline-none"
                          aria-label={isDashboardFav(dashboard.id) ? "Remove from favorites" : "Add to favorites"}
                          title={isDashboardFav(dashboard.id) ? "Remove from favorites" : "Add to favorites"}
                        >
                          {isDashboardFav(dashboard.id) ? "⭐" : "☆"}
                        </button>
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <span className="font-medium text-slate-800">{dashboard.name}</span>
                        {!dashboard.is_public && (
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">-</td>
                    <td className="p-4 text-sm text-slate-600">{formatDate(dashboard.last_viewed_at || dashboard.updated_at)}</td>
                    <td className="p-4 text-sm text-slate-600">{formatDate(dashboard.updated_at)}</td>
                    <td className="p-4">
                      <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-medium">
                        {getUserInitials(dashboard.owner_id)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {dashboardMemberIds[dashboard.id]?.length > 0 ? (
                          <>
                            {dashboardMemberIds[dashboard.id].slice(0, 3).map((userId) => (
                              <div
                                key={userId}
                                className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-medium"
                                title={userId === currentUser?.id ? currentUser?.name || currentUser?.email : "Member"}
                              >
                                {getUserInitials(userId)}
                              </div>
                            ))}
                            {dashboardMemberIds[dashboard.id].length > 3 && (
                              <span className="text-xs text-slate-600">+{dashboardMemberIds[dashboard.id].length - 3}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="relative">
                        <button
                          onClick={(e) => handleContextMenu(e, dashboard)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200"
                        >
                          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {contextMenu && contextMenu.dashboardId === dashboard.id && (
                          <div
                            ref={contextMenuRef}
                            className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[200px]"
                          >
                            <button
                              onClick={() => handleCopyLink(dashboard)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copy link
                            </button>
                            <button
                              onClick={() => handleRename(dashboard)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Rename
                            </button>
                            <button
                              onClick={() => handleDuplicate(dashboard)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Duplicate
                            </button>
                            <button
                              onClick={() => {}}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              Add to favorites
                            </button>
                            <div className="border-t border-slate-200 my-1"></div>
                            <button
                              onClick={() => handleDelete(dashboard)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                            <div className="border-t border-slate-200 my-1"></div>
                            <button
                              onClick={() => handleShareClick(dashboard)}
                              className="w-full text-left px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              Sharing & Permissions
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Share Dashboard Modal */}
      {showShareModal && selectedDashboard && (
        <ShareDashboardModal
          dashboard={selectedDashboard}
          currentUser={currentUser}
          onClose={() => {
            setShowShareModal(false);
            setSelectedDashboard(null);
          }}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}

// Share Dashboard Modal Component
function ShareDashboardModal({
  dashboard,
  currentUser,
  onClose,
  onUpdate,
}: {
  dashboard: Dashboard;
  currentUser: User | null;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sharingData, setSharingData] = useState<{
    dashboard_id: number;
    dashboard_name: string;
    is_public: boolean;
    workspace_shared: boolean;
    share_token: string | null;
    share_link: string | null;
    members: Array<{
      user_id: number;
      role: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
    }>;
    can_manage: boolean;
  } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [peopleExpanded, setPeopleExpanded] = useState(false);

  useEffect(() => {
    loadSharingData();
  }, [dashboard.id]);

  async function loadSharingData() {
    try {
      const data = await dashboardService.getSharing(dashboard.id);
      setSharingData(data);
    } catch (err) {
      console.error("Error loading sharing data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await dashboardService.inviteUser(dashboard.id, { email: inviteEmail.trim() });
      setInviteEmail("");
      await loadSharingData();
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  async function handleCopyLink() {
    if (sharingData?.share_link) {
      await navigator.clipboard.writeText(sharingData.share_link);
      alert("Link copied to clipboard!");
    } else {
      try {
        await dashboardService.updateSharing(dashboard.id, { generate_token: true });
        await loadSharingData();
        const data = await dashboardService.getSharing(dashboard.id);
        if (data.share_link) {
          await navigator.clipboard.writeText(data.share_link);
          alert("Link copied to clipboard!");
        }
      } catch (err) {
        alert("Failed to generate share link");
      }
    }
  }

  async function handleToggleWorkspace() {
    if (!sharingData) return;
    try {
      await dashboardService.updateSharing(dashboard.id, { workspace_shared: !sharingData.workspace_shared });
      await loadSharingData();
      onUpdate();
    } catch (err) {
      alert("Failed to update workspace sharing");
    }
  }

  async function handleMakePublic() {
    if (!sharingData) return;
    try {
      await dashboardService.updateSharing(dashboard.id, {
        is_public: !sharingData.is_public,
        generate_token: !sharingData.share_token ? true : undefined,
      });
      await loadSharingData();
      onUpdate();
    } catch (err) {
      alert("Failed to update dashboard visibility");
    }
  }

  function getUserInitials(userId: number, email: string, name: string | null): string {
    if (currentUser && userId === currentUser.id) {
      const n = currentUser.name || currentUser.email;
      const parts = n.split(" ");
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return n.substring(0, 2).toUpperCase();
    }
    const n = name || email || "?";
    const parts = n.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return n.substring(0, 2).toUpperCase();
  }

  if (loading || !sharingData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="p-6">
          <p className="text-slate-600">Loading...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Share this Dashboard</h2>
              <p className="text-sm text-slate-600">{sharingData.dashboard_name}</p>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Invite by Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Invite by name or email
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Invite by name or email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleInvite();
                  }
                }}
                className="flex-1 bg-white"
              />
              <Button
                variant="primary"
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviting}
                isLoading={inviting}
              >
                Invite
              </Button>
            </div>
          </div>

          {/* Private Link */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <label className="text-sm font-medium text-slate-700">Private link</label>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={sharingData.share_link || "No link generated"}
                readOnly
                className="flex-1 bg-slate-50"
              />
              <Button variant="secondary" onClick={handleCopyLink}>
                Copy link
              </Button>
            </div>
          </div>

          {/* Share with */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Share with</h3>

            {/* Workspace */}
            <div className="mb-3">
              <button
                onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm transition-transform ${workspaceExpanded ? "rotate-90" : ""}`}>
                    ▶
                  </span>
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-medium">
                    {currentUser ? getUserInitials(currentUser.id, currentUser.email, currentUser.name) : "U"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {currentUser?.name || currentUser?.email || "User"}'s Workspace
                    </p>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Workspace</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sharingData.workspace_shared}
                    onChange={handleToggleWorkspace}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </button>
            </div>

            {/* People */}
            <div>
              <button
                onClick={() => setPeopleExpanded(!peopleExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm transition-transform ${peopleExpanded ? "rotate-90" : ""}`}>
                    ▶
                  </span>
                  <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-800">People</span>
                </div>
                <div className="flex items-center gap-2">
                  {sharingData.members.slice(0, 3).map((member) => (
                    <div
                      key={member.user_id}
                      className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-medium"
                      title={member.name || member.email}
                    >
                      {getUserInitials(member.user_id, member.email, member.name)}
                    </div>
                  ))}
                  {sharingData.members.length > 3 && (
                    <span className="text-xs text-slate-600">+{sharingData.members.length - 3}</span>
                  )}
                </div>
              </button>
              {peopleExpanded && (
                <div className="ml-11 mt-2 space-y-2">
                  {sharingData.members.map((member) => (
                    <div key={member.user_id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-medium">
                          {getUserInitials(member.user_id, member.email, member.name)}
                        </div>
                        <span className="text-sm text-slate-800">{member.name || member.email}</span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded capitalize">
                          {member.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Make Public Button */}
          <div className="pt-4 border-t border-slate-200">
            <Button
              variant={sharingData.is_public ? "secondary" : "primary"}
              onClick={handleMakePublic}
              className="w-full flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {sharingData.is_public ? "Make Private" : "Make Public"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
