import { useState, useEffect } from 'react';
import { Clock, Search, Download } from 'lucide-react';
import NGOLayout from '../../components/NGOLayout';
import { useToast } from '../../components/ToastProvider';
import { ngoApi } from '../../services/api';
import { subscribeNgoSync } from '../../utils/ngoSync';
import './NGOCollectionHistory.css';

interface HistoryItem {
  id: number;
  foodName: string;
  donorName: string;
  organizationName: string;
  quantity: number;
  unit: string;
  category: string;
  status: string;
  collectedAt: string;
  createdAt: string;
}

export default function NGOCollectionHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { showToast } = useToast();
  const userId = parseInt(localStorage.getItem('userId') || '0');
  const perPage = 10;

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    const unsubscribe = subscribeNgoSync(() => {
      void loadHistory();
    });

    return unsubscribe;
  }, [userId]);

  async function loadHistory() {
    try {
      const data = await ngoApi.getHistory(userId) as unknown as HistoryItem[];
      setHistory(data || []);
    } catch {
      showToast('Failed to load history', 'error');
    } finally {
      setLoading(false);
    }
  }

  const filtered = history.filter(h => {
    const matchesSearch = !search || h.foodName?.toLowerCase().includes(search.toLowerCase()) || h.donorName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || h.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  function exportCSV() {
    const headers = ['Date', 'Food Name', 'Donor', 'Category', 'Quantity', 'Unit', 'Status'];
    const rows = filtered.map(h => [
      h.collectedAt || h.createdAt, h.foodName, h.donorName || h.organizationName, h.category, h.quantity, h.unit, h.status
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'collection-history.csv'; a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported', 'success');
  }

  function formatDate(d: string) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <NGOLayout>
      <div className="history-page">
        <div className="history-header">
          <h1><Clock size={24} /> Collection History</h1>
          <button className="history-export-btn" onClick={exportCSV}><Download size={16} /> Export CSV</button>
        </div>

        <div className="history-filters">
          <div className="history-search">
            <Search size={16} />
            <input placeholder="Search food or donor..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="all">All Status</option>
            <option value="collected">Collected</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="history-summary">
          <span>{filtered.length} records found</span>
        </div>

        {loading ? <div className="history-loading">Loading...</div> : (
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th><th>Food Name</th><th>Donor</th><th>Category</th><th>Quantity</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr><td colSpan={6} className="history-empty">No records found</td></tr>
                ) : paginated.map(h => (
                  <tr key={h.id}>
                    <td>{formatDate(h.collectedAt || h.createdAt)}</td>
                    <td className="history-food-name">{h.foodName}</td>
                    <td>{h.donorName || h.organizationName || '-'}</td>
                    <td><span className="history-category">{h.category}</span></td>
                    <td>{h.quantity} {h.unit}</td>
                    <td><span className={`history-status status-${h.status}`}>{h.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="history-pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </NGOLayout>
  );
}
