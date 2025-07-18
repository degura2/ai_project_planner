
import React, { useState, useMemo } from 'react';
import { ActionItem } from '../types';
import { XIcon, SortAscIcon, SortDescIcon, CheckSquareIcon, SquareIcon, PaperClipIcon } from './icons';

interface ActionItemTableModalProps {
  actionItems: ActionItem[];
  subStepName: string;
  taskName: string;
  onClose: () => void;
}

type SortKeys = 'status' | 'text' | 'dueDate' | 'responsible' | 'completedDate';
type SortDirection = 'ascending' | 'descending';

const ActionItemTableModal: React.FC<ActionItemTableModalProps> = ({ actionItems, subStepName, taskName, onClose }) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: SortDirection } | null>(null);

  const sortedItems = useMemo(() => {
    let sortableItems = [...actionItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (sortConfig.key) {
          case 'status':
            aValue = a.completed;
            bValue = b.completed;
            break;
          case 'dueDate':
            aValue = a.dueDate || '9999-12-31';
            bValue = b.dueDate || '9999-12-31';
            break;
          case 'completedDate':
             aValue = a.completedDate || '9999-12-31';
             bValue = b.completedDate || '9999-12-31';
             break;
          case 'text':
          case 'responsible':
            aValue = (a[sortConfig.key] || '').toLowerCase();
            bValue = (b[sortConfig.key] || '').toLowerCase();
            break;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [actionItems, sortConfig]);

  const requestSort = (key: SortKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (name: SortKeys) => {
    if (!sortConfig || sortConfig.key !== name) {
      return <SortDescIcon className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-100" />;
    }
    return sortConfig.direction === 'ascending' ? <SortAscIcon className="w-3 h-3 ml-1 text-blue-600" /> : <SortDescIcon className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const SortableHeader: React.FC<{ sortKey: SortKeys; label: string; className?: string }> = ({ sortKey, label, className }) => (
    <th scope="col" className={`p-0 ${className || ''}`}>
       <button onClick={() => requestSort(sortKey)} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50 transition-colors">
        <span>{label}</span>
        {getSortIcon(sortKey)}
      </button>
    </th>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
      <div className="bg-slate-100 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 bg-white rounded-t-xl">
          <div>
             <h3 className="text-xl font-bold text-slate-800">アクションアイテム一覧</h3>
             <p className="text-sm text-slate-500">タスク: {taskName} / サブステップ: {subStepName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100">
            <XIcon className="w-6 h-6 text-slate-500" />
          </button>
        </header>

        <main className="flex-grow p-4 overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-200 z-10">
              <tr>
                <SortableHeader sortKey="status" label="状態" className="w-28 border border-slate-300" />
                <SortableHeader sortKey="text" label="アクションアイテム" className="w-2/5 border border-slate-300" />
                <SortableHeader sortKey="responsible" label="担当者" className="w-40 border border-slate-300" />
                <SortableHeader sortKey="dueDate" label="期日" className="w-40 border border-slate-300" />
                <SortableHeader sortKey="completedDate" label="完了日" className="w-40 border border-slate-300" />
              </tr>
            </thead>
            <tbody className="bg-white">
              {sortedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                   <td className="p-2 border border-slate-300 align-top text-center">
                    {item.completed ? 
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckSquareIcon className="w-4 h-4 mr-1"/>完了
                        </span>
                         : 
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                           <SquareIcon className="w-4 h-4 mr-1"/>未完了
                        </span>
                    }
                   </td>
                  <td className="p-2 border border-slate-300 align-top font-medium text-slate-800">
                    {item.text}
                    {item.report && Array.isArray(item.report.attachments) && item.report.attachments.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                            {item.report.attachments.map(att => (
                                <a 
                                    key={att.id} 
                                    href={att.dataUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    download={att.name}
                                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                                >
                                    <PaperClipIcon className="w-3.5 h-3.5" />
                                    <span>{att.name}</span>
                                </a>
                            ))}
                        </div>
                    )}
                    {item.report?.notes && <p className="text-xs text-slate-500 mt-1 pt-1 border-t border-slate-200 whitespace-pre-wrap">{item.report.notes}</p>}
                  </td>
                  <td className="p-2 border border-slate-300 align-top">{item.responsible || ''}</td>
                  <td className="p-2 border border-slate-300 align-top">{item.dueDate || ''}</td>
                  <td className="p-2 border border-slate-300 align-top">{item.completedDate || ''}</td>
                </tr>
              ))}
              {actionItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">アクションアイテムはありません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </main>

        <footer className="flex-shrink-0 p-4 bg-white border-t flex justify-end gap-3 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700">
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ActionItemTableModal;
