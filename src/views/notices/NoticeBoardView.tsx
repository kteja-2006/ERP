import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { 
  Bell, Plus, Trash2, Calendar, Users, Megaphone,
  BookOpen, CheckCircle, Clock, AlertCircle, X
} from 'lucide-react';

interface Notice {
  id: string;
  school_id: string;
  title: string;
  content: string;
  target_audience: 'all' | 'students' | 'faculty' | 'class_specific';
  target_class_id?: string;
  target_section_id?: string;
  class_name?: string;
  section_name?: string;
  published_by: string;
  publisher_code?: string;
  created_at: string;
}

export const NoticeBoardView: React.FC = () => {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAudience, setFilterAudience] = useState<string>('all_types');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'students' | 'faculty' | 'class_specific'>('all');
  const [targetClassId, setTargetClassId] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canManage = user?.role === 'PRINCIPAL' || user?.role === 'OFFICE' || user?.role === 'SUPER_ADMIN';

  const fetchNotices = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/notices');
      setNotices(res.notices || []);
    } catch (err: any) {
      console.error('Failed to load notices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await apiRequest('/api/academics/structure');
      setClasses(res.classes || []);
    } catch (e) {
      console.error('Failed to load classes for notices:', e);
    }
  };

  useEffect(() => {
    fetchNotices();
    if (canManage) {
      fetchClasses();
    }
  }, []);

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim() || !content.trim()) {
      setErrorMsg('Please enter both title and announcement details.');
      return;
    }

    try {
      setSubmitting(true);
      await apiRequest('/api/notices', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          targetAudience,
          targetClassId: targetAudience === 'class_specific' ? targetClassId : null,
        }),
      });

      setSuccessMsg('Notice published successfully!');
      setTitle('');
      setContent('');
      setTargetAudience('all');
      setTargetClassId('');
      setShowCreateModal(false);
      await fetchNotices();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish notice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this notice?')) return;
    try {
      await apiRequest(`/api/notices/${id}`, { method: 'DELETE' });
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete notice');
    }
  };

  const filteredNotices = notices.filter((n) => {
    if (filterAudience === 'all_types') return true;
    return n.target_audience === filterAudience;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Megaphone className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Institutional Notice Board & Circulars</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official announcements, academic schedules, exam notices, and institutional updates.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center space-x-2 cursor-pointer shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New Notice</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-emerald-700 font-bold">×</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-medium mr-1">Audience:</span>
        <button
          type="button"
          onClick={() => setFilterAudience('all_types')}
          className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
            filterAudience === 'all_types'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Notices ({notices.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterAudience('all')}
          className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
            filterAudience === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          School-Wide
        </button>
        <button
          type="button"
          onClick={() => setFilterAudience('students')}
          className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
            filterAudience === 'students'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Students Only
        </button>
        <button
          type="button"
          onClick={() => setFilterAudience('faculty')}
          className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
            filterAudience === 'faculty'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Faculty & Staff
        </button>
        <button
          type="button"
          onClick={() => setFilterAudience('class_specific')}
          className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-colors ${
            filterAudience === 'class_specific'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Class Specific
        </button>
      </div>

      {/* Notices List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
          Loading institutional notices...
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400 space-y-2">
          <Bell className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-600">No notices found</p>
          <p className="text-slate-400">There are currently no active circulars matching this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotices.map((notice) => {
            const dateStr = new Date(notice.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={notice.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm leading-snug">
                      {notice.title}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNotice(notice.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        title="Delete Notice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {notice.content}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                      {dateStr}
                    </span>
                    {notice.publisher_code && (
                      <span>• By {notice.publisher_code}</span>
                    )}
                  </div>

                  <div>
                    {notice.target_audience === 'all' && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold uppercase">
                        All School
                      </span>
                    )}
                    {notice.target_audience === 'students' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold uppercase">
                        Students
                      </span>
                    )}
                    {notice.target_audience === 'faculty' && (
                      <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold uppercase">
                        Faculty
                      </span>
                    )}
                    {notice.target_audience === 'class_specific' && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold uppercase">
                        {notice.class_name ? `Class: ${notice.class_name}` : 'Specific Class'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Notice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Publish Institutional Notice</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotice} className="p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notice Title / Subject *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Sports Meet 2026 or Parent-Teacher Conference"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Audience *</label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 cursor-pointer"
                >
                  <option value="all">Whole School (Students, Faculty & Staff)</option>
                  <option value="students">Students & Parents Only</option>
                  <option value="faculty">Faculty & Teaching Staff Only</option>
                  <option value="class_specific">Class-Specific Circular</option>
                </select>
              </div>

              {targetAudience === 'class_specific' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Class *</label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 cursor-pointer"
                  >
                    <option value="">Select target class...</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.class_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notice Content / Instructions *</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write official announcement details, reporting timings, guidelines, etc..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-600 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
