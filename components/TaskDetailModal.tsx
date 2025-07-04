import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { ProjectTask, EditableExtendedTaskDetails, SubStep, ActionItem, Attachment, SubStepStatus, SlideDeck, Decision } from '../types';
import { XIcon, PlusCircleIcon, TrashIcon, SubtaskIcon, PaperClipIcon, SparklesIcon, ClipboardDocumentListIcon, LockClosedIcon, LockOpenIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, PresentationChartBarIcon } from './icons';
import { generateStepProposals, generateInitialSlideDeck } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import ProposalReviewModal from './ProposalReviewModal';
import ActionItemReportModal from './ActionItemReportModal';
import ActionItemTableModal from './ActionItemTableModal';
import SlideEditorView from './SlideEditorView';
import CustomTaskReportModal from './CustomTaskReportModal';
import DecisionModal from './DecisionModal';

interface TaskDetailModalProps {
  task: ProjectTask;
  onClose: () => void;
  onUpdateTaskCoreInfo: (taskId: string, updates: { title: string; description: string; status: any }) => void;
  onUpdateExtendedDetails: (taskId: string, details: EditableExtendedTaskDetails) => void;
  generateUniqueId: (prefix: string) => string;
  projectGoal: string;
  targetDate: string;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  onUpdateTaskCoreInfo,
  onUpdateExtendedDetails,
  generateUniqueId,
  projectGoal,
  targetDate,
}) => {
  const [localTask, setLocalTask] = useState<ProjectTask>(task);
  const [extendedDetails, setExtendedDetails] = useState<EditableExtendedTaskDetails>(
    task.extendedDetails || {
      subSteps: [],
      resources: '',
      responsible: '',
      notes: '',
      numericalTarget: undefined,
      dueDate: '',
      reportDeck: undefined,
      resourceMatrix: null,
      attachments: [],
      decisions: [],
      subStepCanvasSize: { width: 1200, height: 800 },
    }
  );

  const [isGeneratingProposals, setIsGeneratingProposals] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposals, setProposals] = useState<{ title: string; description: string }[]>([]);

  const [selectedActionItem, setSelectedActionItem] = useState<ActionItem | null>(null);
  const [selectedSubStepForReport, setSelectedSubStepForReport] = useState<{ subStep: SubStep; task: ProjectTask } | null>(null);

  const [isReportEditorOpen, setIsReportEditorOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [isCustomReportModalOpen, setIsCustomReportModalOpen] = useState(false);
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);

  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [draggedSubStep, setDraggedSubStep] = useState<SubStep | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalTask(task);
    setExtendedDetails(task.extendedDetails || {
      subSteps: [],
      resources: '',
      responsible: '',
      notes: '',
      numericalTarget: undefined,
      dueDate: '',
      reportDeck: undefined,
      resourceMatrix: null,
      attachments: [],
      decisions: [],
      subStepCanvasSize: { width: 1200, height: 800 },
    });
  }, [task]);

  const handleSave = () => {
    onUpdateTaskCoreInfo(localTask.id, {
      title: localTask.title,
      description: localTask.description,
      status: localTask.status,
    });
    onUpdateExtendedDetails(localTask.id, extendedDetails);
    onClose();
  };

  const updateExtendedDetails = (updates: Partial<EditableExtendedTaskDetails>) => {
    setExtendedDetails(prev => ({ ...prev, ...updates }));
  };

  const handleGenerateProposals = async () => {
    setIsGeneratingProposals(true);
    setProposalError(null);
    try {
      const newProposals = await generateStepProposals(localTask);
      setProposals(newProposals);
      setIsProposalModalOpen(true);
    } catch (error) {
      setProposalError(error instanceof Error ? error.message : 'ステップ提案の生成に失敗しました。');
    } finally {
      setIsGeneratingProposals(false);
    }
  };

  const handleProposalConfirm = ({ newSubSteps, newActionItems }: { newSubSteps: { title: string; description: string }[], newActionItems: { targetSubStepId: string, title: string }[] }) => {
    const updatedSubSteps = [...extendedDetails.subSteps];
    
    newSubSteps.forEach(proposal => {
      const newSubStep: SubStep = {
        id: generateUniqueId('substep'),
        text: proposal.title,
        notes: proposal.description,
        status: SubStepStatus.NOT_STARTED,
        position: { x: 10, y: updatedSubSteps.length * 90 + 10 },
        actionItems: [],
      };
      updatedSubSteps.push(newSubStep);
    });

    newActionItems.forEach(({ targetSubStepId, title }) => {
      const targetSubStep = updatedSubSteps.find(ss => ss.id === targetSubStepId);
      if (targetSubStep) {
        const newActionItem: ActionItem = {
          id: generateUniqueId('action'),
          text: title,
          completed: false,
        };
        targetSubStep.actionItems = [...(targetSubStep.actionItems || []), newActionItem];
      }
    });

    updateExtendedDetails({ subSteps: updatedSubSteps });
    setIsProposalModalOpen(false);
  };

  const addSubStep = () => {
    const newSubStep: SubStep = {
      id: generateUniqueId('substep'),
      text: '新しいサブステップ',
      status: SubStepStatus.NOT_STARTED,
      position: { x: 10, y: extendedDetails.subSteps.length * 90 + 10 },
      actionItems: [],
    };
    updateExtendedDetails({ subSteps: [...extendedDetails.subSteps, newSubStep] });
  };

  const updateSubStep = (subStepId: string, updates: Partial<SubStep>) => {
    const updatedSubSteps = extendedDetails.subSteps.map(ss =>
      ss.id === subStepId ? { ...ss, ...updates } : ss
    );
    updateExtendedDetails({ subSteps: updatedSubSteps });
  };

  const removeSubStep = (subStepId: string) => {
    const updatedSubSteps = extendedDetails.subSteps.filter(ss => ss.id !== subStepId);
    updateExtendedDetails({ subSteps: updatedSubSteps });
  };

  const addActionItem = (subStepId: string) => {
    const newActionItem: ActionItem = {
      id: generateUniqueId('action'),
      text: '新しいアクションアイテム',
      completed: false,
    };
    
    const updatedSubSteps = extendedDetails.subSteps.map(ss =>
      ss.id === subStepId
        ? { ...ss, actionItems: [...(ss.actionItems || []), newActionItem] }
        : ss
    );
    updateExtendedDetails({ subSteps: updatedSubSteps });
  };

  const updateActionItem = (subStepId: string, actionItemId: string, updates: Partial<ActionItem>) => {
    const updatedSubSteps = extendedDetails.subSteps.map(ss =>
      ss.id === subStepId
        ? {
            ...ss,
            actionItems: (ss.actionItems || []).map(ai =>
              ai.id === actionItemId ? { ...ai, ...updates } : ai
            ),
          }
        : ss
    );
    updateExtendedDetails({ subSteps: updatedSubSteps });
  };

  const removeActionItem = (subStepId: string, actionItemId: string) => {
    const updatedSubSteps = extendedDetails.subSteps.map(ss =>
      ss.id === subStepId
        ? { ...ss, actionItems: (ss.actionItems || []).filter(ai => ai.id !== actionItemId) }
        : ss
    );
    updateExtendedDetails({ subSteps: updatedSubSteps });
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE_MB = 5;
    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
    
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`ファイルサイズが大きすぎます。${MAX_FILE_SIZE_MB}MB未満のファイルを選択してください。`);
      if (event.target) event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        const newAttachment: Attachment = {
          id: generateUniqueId('attach'),
          name: file.name,
          type: file.type,
          dataUrl: e.target.result,
        };
        updateExtendedDetails({
          attachments: [...(extendedDetails.attachments || []), newAttachment],
        });
      } else {
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    reader.onerror = () => {
      alert('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  };

  const removeAttachment = (attachmentId: string) => {
    updateExtendedDetails({
      attachments: extendedDetails.attachments?.filter(a => a.id !== attachmentId),
    });
  };

  const handleGenerateReport = async () => {
    if (extendedDetails.reportDeck) {
      setIsReportEditorOpen(true);
      return;
    }
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const deck = await generateInitialSlideDeck(localTask, projectGoal);
      updateExtendedDetails({ reportDeck: deck });
      setIsReportEditorOpen(true);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'レポートの生成に失敗しました。');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleReportSave = (deck: SlideDeck) => {
    updateExtendedDetails({ reportDeck: deck });
  };

  const handleCustomReportGenerated = (deck: SlideDeck) => {
    updateExtendedDetails({ reportDeck: deck });
    setIsCustomReportModalOpen(false);
    setIsReportEditorOpen(true);
  };

  const handleDecisionsSave = (decisions: Decision[]) => {
    updateExtendedDetails({ decisions });
    setIsDecisionModalOpen(false);
  };

  const handleSubStepDragStart = (subStep: SubStep, event: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggedSubStep(subStep);
    setDragOffset({
      x: event.clientX - rect.left - (subStep.position?.x || 0),
      y: event.clientY - rect.top - (subStep.position?.y || 0),
    });
  };

  const handleCanvasMouseMove = (event: React.MouseEvent) => {
    if (!draggedSubStep || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(0, event.clientX - rect.left - dragOffset.x);
    const newY = Math.max(0, event.clientY - rect.top - dragOffset.y);
    updateSubStep(draggedSubStep.id, { position: { x: newX, y: newY } });
  };

  const handleCanvasMouseUp = () => {
    setDraggedSubStep(null);
  };

  const getStatusColor = (status?: SubStepStatus) => {
    switch (status) {
      case SubStepStatus.COMPLETED: return 'border-green-500';
      case SubStepStatus.IN_PROGRESS: return 'border-blue-500';
      default: return 'border-slate-400';
    }
  };

  const getStatusBgColor = (status?: SubStepStatus) => {
    switch (status) {
      case SubStepStatus.COMPLETED: return 'bg-green-50';
      case SubStepStatus.IN_PROGRESS: return 'bg-blue-50';
      default: return 'bg-slate-50';
    }
  };

  const allActionItems = extendedDetails.subSteps.flatMap(ss => 
    (ss.actionItems || []).map(ai => ({ ...ai, subStepName: ss.text, taskName: localTask.title }))
  );

  if (isReportEditorOpen && extendedDetails.reportDeck) {
    return (
      <SlideEditorView
        tasks={[{ ...localTask, extendedDetails }]}
        initialDeck={extendedDetails.reportDeck}
        onSave={handleReportSave}
        onClose={() => setIsReportEditorOpen(false)}
        projectGoal={projectGoal}
        targetDate={targetDate}
        reportScope="task"
        generateUniqueId={generateUniqueId}
      />
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[50]">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col">
          <header className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
            <h3 className="text-xl font-bold text-slate-800">詳細計画</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDecisionModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"
              >
                <ClipboardDocumentListIcon className="w-5 h-5" />
                決定事項管理
              </button>
              <button
                onClick={() => setIsCustomReportModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                <SparklesIcon className="w-5 h-5" />
                カスタムレポート作成
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-slate-400"
              >
                {isGeneratingReport ? <LoadingSpinner size="sm" color="border-white" /> : <PresentationChartBarIcon className="w-5 h-5" />}
                {extendedDetails.reportDeck ? 'レポートを開く' : 'レポート作成'}
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-100"
                title="閉じる"
              >
                <XIcon className="w-6 h-6 text-slate-500" />
              </button>
            </div>
          </header>

          <div className="flex-grow flex overflow-hidden">
            <div className="w-1/3 p-5 border-r border-slate-200 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">タスクタイトル</label>
                  <input
                    type="text"
                    value={localTask.title}
                    onChange={(e) => setLocalTask(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">タスク説明</label>
                  <textarea
                    value={localTask.description}
                    onChange={(e) => setLocalTask(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">必要なリソース</label>
                  <textarea
                    value={extendedDetails.resources}
                    onChange={(e) => updateExtendedDetails({ resources: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="必要な人員、設備、予算など"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">責任者</label>
                  <input
                    type="text"
                    value={extendedDetails.responsible}
                    onChange={(e) => updateExtendedDetails({ responsible: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="担当者名"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">期日</label>
                  <input
                    type="date"
                    value={extendedDetails.dueDate || ''}
                    onChange={(e) => updateExtendedDetails({ dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">メモ</label>
                  <textarea
                    value={extendedDetails.notes}
                    onChange={(e) => updateExtendedDetails({ notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="追加の詳細や注意事項"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">添付ファイル</label>
                    <button
                      onClick={() => attachmentInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100"
                      title="ファイルを添付"
                    >
                      <PaperClipIcon className="w-5 h-5" />
                    </button>
                    <input
                      type="file"
                      ref={attachmentInputRef}
                      onChange={handleAttachmentChange}
                      className="hidden"
                      multiple={false}
                    />
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {(extendedDetails.attachments || []).map(attachment => (
                      <div key={attachment.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-md">
                        <a
                          href={attachment.dataUrl}
                          download={attachment.name}
                          className="text-sm text-blue-600 hover:underline truncate flex-grow"
                          title={attachment.name}
                        >
                          {attachment.name}
                        </a>
                        <button
                          onClick={() => removeAttachment(attachment.id)}
                          className="text-red-500 hover:text-red-700 ml-2"
                          title="削除"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {reportError && (
                  <div className="text-red-600 text-sm bg-red-100 border border-red-400 p-2 rounded-md">
                    {reportError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-grow flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h4 className="text-lg font-semibold text-slate-800">サブステップ</h4>
                  <button
                    onClick={() => setIsCanvasExpanded(!isCanvasExpanded)}
                    className="p-1 text-slate-600 hover:text-slate-800"
                    title={isCanvasExpanded ? "縮小表示" : "拡大表示"}
                  >
                    {isCanvasExpanded ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateProposals}
                    disabled={isGeneratingProposals}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-slate-400"
                  >
                    {isGeneratingProposals ? <LoadingSpinner size="sm" color="border-white" /> : <SparklesIcon className="w-5 h-5" />}
                    AI提案
                  </button>
                  <button
                    onClick={addSubStep}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    <PlusCircleIcon className="w-5 h-5" />
                    追加
                  </button>
                  {allActionItems.length > 0 && (
                    <button
                      onClick={() => setSelectedSubStepForReport({ subStep: { id: 'all', text: 'すべて' } as SubStep, task: localTask })}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300"
                    >
                      <ClipboardDocumentListIcon className="w-5 h-5" />
                      一覧表示
                    </button>
                  )}
                </div>
              </div>

              {proposalError && (
                <div className="mx-4 mt-2 text-red-600 text-sm bg-red-100 border border-red-400 p-2 rounded-md">
                  {proposalError}
                </div>
              )}

              <div className="flex-grow overflow-hidden">
                {isCanvasExpanded ? (
                  <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col">
                    <div className="flex items-center justify-between p-4 bg-slate-800 text-white">
                      <h3 className="text-lg font-semibold">サブステップ詳細ビュー</h3>
                      <button
                        onClick={() => setIsCanvasExpanded(false)}
                        className="p-2 hover:bg-slate-700 rounded-md"
                      >
                        <XIcon className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="flex-grow bg-slate-100 overflow-auto">
                      {renderSubStepCanvas()}
                    </div>
                  </div>
                ) : (
                  <div className="h-full overflow-auto bg-slate-50">
                    {renderSubStepCanvas()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <footer className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
            >
              保存
            </button>
          </footer>
        </div>
      </div>

      {isProposalModalOpen && (
        <ProposalReviewModal
          proposals={proposals}
          existingSubSteps={extendedDetails.subSteps}
          onConfirm={handleProposalConfirm}
          onClose={() => setIsProposalModalOpen(false)}
        />
      )}

      {selectedActionItem && (
        <ActionItemReportModal
          actionItem={selectedActionItem}
          onSave={(updatedItem) => {
            const subStep = extendedDetails.subSteps.find(ss =>
              ss.actionItems?.some(ai => ai.id === updatedItem.id)
            );
            if (subStep) {
              updateActionItem(subStep.id, updatedItem.id, updatedItem);
            }
            setSelectedActionItem(null);
          }}
          onClose={() => setSelectedActionItem(null)}
          generateUniqueId={generateUniqueId}
        />
      )}

      {selectedSubStepForReport && (
        <ActionItemTableModal
          actionItems={selectedSubStepForReport.subStep.id === 'all' ? allActionItems : (selectedSubStepForReport.subStep.actionItems || [])}
          subStepName={selectedSubStepForReport.subStep.text}
          taskName={selectedSubStepForReport.task.title}
          onClose={() => setSelectedSubStepForReport(null)}
        />
      )}

      {isCustomReportModalOpen && (
        <CustomTaskReportModal
          task={{ ...localTask, extendedDetails }}
          isOpen={isCustomReportModalOpen}
          onClose={() => setIsCustomReportModalOpen(false)}
          onReportGenerated={handleCustomReportGenerated}
        />
      )}

      {isDecisionModalOpen && (
        <DecisionModal
          isOpen={isDecisionModalOpen}
          onClose={() => setIsDecisionModalOpen(false)}
          onSave={handleDecisionsSave}
          task={{ ...localTask, extendedDetails }}
          generateUniqueId={generateUniqueId}
        />
      )}
    </>
  );

  function renderSubStepCanvas() {
    return (
      <div
        ref={canvasRef}
        className="relative w-full h-full min-h-[600px] p-4"
        style={{
          width: extendedDetails.subStepCanvasSize?.width || 1200,
          height: extendedDetails.subStepCanvasSize?.height || 800,
        }}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
      >
        {extendedDetails.subSteps.map((subStep) => (
          <div
            key={subStep.id}
            className={`absolute bg-white rounded-lg shadow-md border-l-4 ${getStatusColor(subStep.status)} ${getStatusBgColor(subStep.status)} p-4 w-80 cursor-move`}
            style={{
              left: subStep.position?.x || 0,
              top: subStep.position?.y || 0,
            }}
            onMouseDown={(e) => handleSubStepDragStart(subStep, e)}
          >
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                value={subStep.text}
                onChange={(e) => updateSubStep(subStep.id, { text: e.target.value })}
                className="font-semibold text-slate-800 bg-transparent border-none outline-none flex-grow"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSubStep(subStep.id);
                }}
                className="text-red-500 hover:text-red-700 ml-2"
                title="削除"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">ステータス:</label>
                <select
                  value={subStep.status || SubStepStatus.NOT_STARTED}
                  onChange={(e) => updateSubStep(subStep.id, { status: e.target.value as SubStepStatus })}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value={SubStepStatus.NOT_STARTED}>未着手</option>
                  <option value={SubStepStatus.IN_PROGRESS}>進行中</option>
                  <option value={SubStepStatus.COMPLETED}>完了</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">担当者:</label>
                <input
                  type="text"
                  value={subStep.responsible || ''}
                  onChange={(e) => updateSubStep(subStep.id, { responsible: e.target.value })}
                  className="text-xs border border-slate-300 rounded px-2 py-1 flex-grow"
                  placeholder="担当者名"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600">期日:</label>
                <input
                  type="date"
                  value={subStep.dueDate || ''}
                  onChange={(e) => updateSubStep(subStep.id, { dueDate: e.target.value })}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">アクションアイテム</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addActionItem(subStep.id);
                  }}
                  className="text-blue-600 hover:text-blue-800"
                  title="アクションアイテムを追加"
                >
                  <PlusCircleIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {(subStep.actionItems || []).map((actionItem) => (
                  <div key={actionItem.id} className="flex items-center gap-2 p-1 bg-slate-100 rounded text-xs">
                    <input
                      type="checkbox"
                      checked={actionItem.completed}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateActionItem(subStep.id, actionItem.id, { completed: e.target.checked });
                      }}
                      className="w-3 h-3"
                    />
                    <input
                      type="text"
                      value={actionItem.text}
                      onChange={(e) => updateActionItem(subStep.id, actionItem.id, { text: e.target.value })}
                      className="flex-grow bg-transparent border-none outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <input
                      type="text"
                      value={actionItem.responsible || ''}
                      onChange={(e) => updateActionItem(subStep.id, actionItem.id, { responsible: e.target.value })}
                      className="w-20 bg-transparent border border-slate-300 rounded px-1 py-0.5 text-xs"
                      placeholder="担当者"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedActionItem(actionItem);
                      }}
                      className="text-green-600 hover:text-green-800"
                      title="実施レポート"
                    >
                      <SubtaskIcon className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeActionItem(subStep.id, actionItem.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="削除"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <textarea
              value={subStep.notes || ''}
              onChange={(e) => updateSubStep(subStep.id, { notes: e.target.value })}
              className="w-full text-xs border border-slate-300 rounded px-2 py-1 resize-none"
              rows={2}
              placeholder="メモ..."
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ))}
      </div>
    );
  }
};

export default TaskDetailModal;