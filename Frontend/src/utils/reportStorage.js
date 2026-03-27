const REPORTS_STORAGE_KEY = 'bodha_reports_history';

const getUserKey = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return user?.id || user?.email || 'guest';
    } catch {
        return 'guest';
    }
};

const getStore = () => {
    try {
        return JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
};

const writeStore = (store) => {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(store));
};

export const addUserReport = (report) => {
    const store = getStore();
    const userKey = getUserKey();
    const existing = Array.isArray(store[userKey]) ? store[userKey] : [];

    const entry = {
        id: `rep-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        createdAt: new Date().toISOString(),
        ...report,
    };

    store[userKey] = [entry, ...existing];
    writeStore(store);
    return entry;
};

export const getUserReports = () => {
    const store = getStore();
    const userKey = getUserKey();
    const reports = Array.isArray(store[userKey]) ? store[userKey] : [];
    return reports.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
