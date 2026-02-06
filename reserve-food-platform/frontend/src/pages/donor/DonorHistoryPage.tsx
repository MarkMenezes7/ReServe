import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Star,
} from 'lucide-react';
import Layout from '../../components/Layout';
import { useToast } from '../../components/ToastProvider';
import { donorApi } from '../../services/api';
import './DonorHistoryPage.css';

type StatusFilter = 'all' | 'active' | 'claimed' | 'collected' | 'expired';

interface HistoryEntry {
  id: number;
  foodName: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  createdAt: string;
  claimedBy?: string;
  claimedByOrg?: string;
  rating?: number;
  collectedAt?: string;
}

const ITEMS_PER_PAGE = 10;

export default function DonorHistoryPage() {
  const userId = parseInt(localStorage.getItem('userId') || '0');
  const { showToast } = useToast();

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      setLoading(true);
      const data = await donorApi.getHistory(userId) as unknown as HistoryEntry[];
      setHistory(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const filteredHistory = useMemo(() => {
    return history.filter(entry => {
      const matchesSearch =
        !searchQuery ||
        entry.foodName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' || entry.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [history, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));

  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const total = history.length;
    const collected = history.filter(e => e.status === 'collected').length;
    const totalQty = history.reduce((sum, e) => sum + (e.quantity || 0), 0);
    const avgRating = history.filter(e => e.rating).length > 0
      ? history.filter(e => e.rating).reduce((sum, e) => sum + (e.rating || 0), 0) / history.filter(e => e.rating).length
      : 0;
    return { total, collected, totalQty, avgRating };
  }, [history]);

  function getStatusIcon(status: string) {
    switch (status) {
      case 'active':
        return <CheckCircle size={14} className="history-status-icon active" />;
      case 'claimed':
        return <Clock size={14} className="history-status-icon claimed" />;
      case 'collected':
        return <CheckCircle size={14} className="history-status-icon collected" />;
      case 'expired':
        return <AlertCircle size={14} className="history-status-icon expired" />;
      default:
        return null;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatCategoryLabel(cat: string): string {
    return cat
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  function exportToCSV() {
    if (filteredHistory.length === 0) {
      showToast('No data to export', 'warning');
      return;
    }

    const headers = ['Date', 'Food Name', 'Category', 'Quantity', 'Unit', 'Status', 'Claimed By', 'Rating'];
    const rows = filteredHistory.map(entry => [
      entry.createdAt ? formatDate(entry.createdAt) : '',
      entry.foodName,
      formatCategoryLabel(entry.category),
      entry.quantity.toString(),
      entry.unit,
      entry.status,
      entry.claimedByOrg || entry.claimedBy || '',
      entry.rating ? entry.rating.toString() : '',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `donation-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('History exported successfully', 'success');
  }

  if (loading) {
    return (
      <Layout>
        <div className="history-loading">
          <RefreshCw className="history-spinner" size={32} />
          <p>Loading history...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="donor-history">
        {/* Page Header */}
        <div className="history-header">
          <div>
            <h1 className="history-title">Donation History</h1>
            <p className="history-subtitle">
              Complete record of all your food donations
            </p>
          </div>
          <button className="history-export-btn" onClick={exportToCSV}>
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* Summary Stats */}
        <div className="history-summary-grid">
          <motion.div
            className="history-summary-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Package size={20} className="history-summary-icon green" />
            <div className="history-summary-value">{summaryStats.total}</div>
            <div className="history-summary-label">Total Listings</div>
          </motion.div>

          <motion.div
            className="history-summary-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <CheckCircle size={20} className="history-summary-icon blue" />
            <div className="history-summary-value">{summaryStats.collected}</div>
            <div className="history-summary-label">Collected</div>
          </motion.div>

          <motion.div
            className="history-summary-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <TrendingUp size={20} className="history-summary-icon orange" />
            <div className="history-summary-value">{summaryStats.totalQty.toFixed(1)} kg</div>
            <div className="history-summary-label">Total Quantity</div>
          </motion.div>

          <motion.div
            className="history-summary-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Star size={20} className="history-summary-icon purple" />
            <div className="history-summary-value">
              {summaryStats.avgRating > 0 ? summaryStats.avgRating.toFixed(1) : '--'}
            </div>
            <div className="history-summary-label">Avg Rating</div>
          </motion.div>
        </div>

        {/* Filters Row */}
        <div className="history-filters">
          <div className="history-search-wrapper">
            <Search size={16} className="history-search-icon" />
            <input
              type="text"
              className="history-search-input"
              placeholder="Search by food name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="history-filter-wrapper">
            <Filter size={16} className="history-filter-icon" />
            <select
              className="history-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="claimed">Claimed</option>
              <option value="collected">Collected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <motion.div
          className="history-table-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {filteredHistory.length === 0 ? (
            <div className="history-empty">
              <Package size={48} />
              <h3>No donations found</h3>
              <p>
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Your donation history will appear here once you start donating.'}
              </p>
            </div>
          ) : (
            <>
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Food Name</th>
                      <th>Category</th>
                      <th>Quantity</th>
                      <th>Status</th>
                      <th>Claimed By</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((entry, index) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * index }}
                      >
                        <td className="history-td-date">
                          {entry.createdAt ? formatDate(entry.createdAt) : '--'}
                        </td>
                        <td className="history-td-name">{entry.foodName}</td>
                        <td className="history-td-category">
                          {formatCategoryLabel(entry.category)}
                        </td>
                        <td className="history-td-quantity">
                          {entry.quantity} {entry.unit}
                        </td>
                        <td>
                          <span className={`history-status-badge ${entry.status}`}>
                            {getStatusIcon(entry.status)}
                            {entry.status}
                          </span>
                        </td>
                        <td className="history-td-claimed">
                          {entry.claimedByOrg || entry.claimedBy || '--'}
                        </td>
                        <td className="history-td-rating">
                          {entry.rating ? (
                            <span className="history-rating">
                              <Star size={13} className="history-star-icon" />
                              {entry.rating.toFixed(1)}
                            </span>
                          ) : (
                            '--'
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="history-pagination">
                <span className="history-pagination-info">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                  {' '}-{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)}
                  {' '}of{' '}{filteredHistory.length}
                </span>

                <div className="history-pagination-controls">
                  <button
                    className="history-page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 5) return true;
                      if (page === 1 || page === totalPages) return true;
                      return Math.abs(page - currentPage) <= 1;
                    })
                    .reduce<(number | string)[]>((acc, page, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      typeof item === 'string' ? (
                        <span key={`ellipsis-${idx}`} className="history-page-ellipsis">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          className={`history-page-btn ${currentPage === item ? 'active' : ''}`}
                          onClick={() => setCurrentPage(item)}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    className="history-page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
