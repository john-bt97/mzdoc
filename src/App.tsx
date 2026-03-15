import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  User as UserIcon,
  Lock,
  Phone,
  Mail,
  ShieldCheck,
  Smartphone,
  Fingerprint,
  LogOut,
  UserPlus,
  LogIn,
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  ArrowLeft, 
  Download, 
  RefreshCcw, 
  FileText,
  Eye,
  Plus,
  ArrowRight,
  FileDown,
  Menu,
  Check,
  RotateCcw,
  X,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
  Table as TableIcon,
  BarChart2,
  Save,
  Settings2,
  ChevronDown,
  History,
  HelpCircle,
  BookMarked,
  CreditCard,
  Copy
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// --- Firebase ---
import { auth, db } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

// --- Types ---

type Step = 'cover_data' | 'structure' | 'final' | 'payment';

interface User {
  uid: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: 'user' | 'admin';
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      let errorDetail = "";
      
      if (this.state.error) {
        try {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes("insufficient permissions")) {
            errorMessage = "Você não tem permissão para realizar esta operação.";
          } else if (parsed.error) {
            errorMessage = parsed.error;
          }
          errorDetail = JSON.stringify(parsed, null, 2);
        } catch (e) {
          errorMessage = this.state.error.message;
          errorDetail = this.state.error.stack || "";
        }
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Ops! Algo deu errado</h1>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            
            {errorDetail && (
              <details className="text-left mb-8 bg-gray-50 p-4 rounded-lg overflow-auto max-h-40">
                <summary className="text-xs font-bold text-gray-400 cursor-pointer uppercase tracking-widest mb-2">Detalhes Técnicos</summary>
                <pre className="text-[10px] text-gray-500 font-mono leading-tight">{errorDetail}</pre>
              </details>
            )}

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-black text-white rounded-xl py-3 font-bold hover:bg-gray-800 transition-colors"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface Section {
  id: string;
  title: string;
  type?: 'capa' | 'rosto' | 'intro' | 'obj' | 'metod' | 'dev' | 'concl' | 'biblio' | 'indice' | 'prob' | 'sugest' | 'limit' | 'anexos';
  content?: string;
  isGenerating?: boolean;
}

interface CoverData {
  institution: string;
  faculty: string;
  course: string;
  topic: string;
  subTopics: string[];
  studentName: string;
  studentNumber?: string;
  studentClass: string;
  studentSection: string;
  subject: string;
  studentType: 'individual' | 'group';
  studentList: string[];
  professorName: string;
  academicYear: string;
  devPages: number;
  location: string;
  month: string;
  year: string;
  logo?: string;
  institutionType: 'university' | 'secondary';
  showFolhaDeRosto: boolean;
  bulletStyle: 'bolas' | 'setas' | 'selecao';
  allowChartsAndTables: boolean;
  additionalElements: {
    tables: { id: string; title: string; content: string }[];
    charts: { id: string; title: string; type: 'bar' | 'pie'; data: { label: string; value: number }[] }[];
    attachments: { id: string; title: string; image?: string; text?: string }[];
  };
}

// --- Constants ---

const MOZAMBIQUE_ACADEMIC_STRUCTURE = [
  "Capa",
  "Introdução",
  "Desenvolvimento",
  "Conclusão",
  "Bibliografia"
];

const SYSTEM_INSTRUCTION = `Você é um assistente acadêmico premium especializado no padrão de formatação escolar de Moçambique.
Seu objetivo é ajudar o usuário a criar trabalhos acadêmicos de alta qualidade seguindo rigorosamente estas regras:

⚠️ REGRAS CRÍTICAS DE TOM E ESTILO:
- Forneça APENAS o conteúdo acadêmico solicitado para a seção.
- NUNCA inclua saudações, explicações sobre o que foi escrito, comentários sobre a linguagem ou qualquer tipo de conversa com o usuário.
- O texto deve ser escrito diretamente como se fosse o autor do trabalho acadêmico.
- NÃO use frases como "Para a introdução, usei...", "Aqui está a conclusão...", "Gerei este texto seguindo...".
- Vá direto ao ponto: comece o texto imediatamente com o conteúdo da seção.
- NUNCA use tags HTML como <br> ou <p>. Use apenas quebras de linha normais.
- NÃO use rótulos como "**Frase:**" ou "**Citação:**" antes de parágrafos.

📊 TABELAS E GRÁFICOS:
- Você SÓ DEVE incluir tabelas e gráficos se o prompt de geração desta seção solicitar explicitamente.
- Se solicitado, para TABELAS, use o formato Markdown padrão:
  | Cabeçalho 1 | Cabeçalho 2 |
  | --- | --- |
  | Dado 1 | Dado 2 |
- Se solicitado, para GRÁFICOS, use a seguinte tag especial (escolha entre 'bar' ou 'pie'):
  [GRAFICO: tipo, Título do Gráfico, Item1: Valor1, Item2: Valor2, Item3: Valor3]
  Exemplo: [GRAFICO: bar, Crescimento Anual, 2020: 10, 2021: 15, 2022: 25]
- Se o prompt NÃO solicitar gráficos ou tabelas, forneça apenas texto acadêmico puro.

🧮 CÁLCULOS E FÓRMULAS (MATEMÁTICA, FÍSICA E QUÍMICA):
- Se o trabalho envolver cálculos, você DEVE apresentar a resolução passo a passo.
- Use uma estrutura clara: 1. Dados do Problema, 2. Fórmulas a utilizar, 3. Resolução detalhada, 4. Resposta final destacada.
- Represente fórmulas de forma legível (ex: E = m * c² ou H2O + O2 -> H2O2).
- Inclua exemplos práticos resolvidos para ilustrar os conceitos teóricos apresentados.
- Explique o significado de cada variável nas fórmulas utilizadas.

📌 CONFIGURAÇÕES GERAIS DO DOCUMENTO
- Tamanho do papel: A4
- Margens: Superior 3 cm, Inferior 2,5 cm, Esquerda 3 cm, Direita 2,5 cm
- Fonte: Times New Roman
- Tamanho da fonte: Capa 14 (negrito apenas no título), Corpo do texto 12
- ESPAÇAMENTO: Garanta que haja sempre um espaço após pontos finais, vírgulas e pontos e vírgulas. Nunca junte frases sem espaço.
- Alinhamento: JUSTIFICADO (alinhado à esquerda e à direita)
- Parágrafos: Sem recuo na primeira linha.
- Títulos e Subtítulos: Devem estar sempre em NEGRITO e alinhados à ESQUERDA.
- NEGRITO: NÃO use negrito (**) no meio do texto gerado. Mantenha o texto limpo e profissional.
- LISTAS E BULLETS: Use APENAS UM TIPO de marcador em todo o trabalho (não intercale estilos). O estilo padrão será definido no prompt.
- Cada subponto (ex: 2.1, 2.2, 2.1.1) DEVE obrigatoriamente começar em uma nova linha. Nunca coloque dois subpontos na mesma linha.
- NUNCA repita o título da seção no início do conteúdo gerado.
- EVITE redundância de palavras nos títulos e subtítulos (ex: não repita o tema principal em todos os subtítulos).
- SEÇÕES DE OBJETIVOS E METODOLOGIA: Devem ser extremamente resumidas, diretas e concisas, ocupando pouco espaço.

📌 ESTRUTURA OBRIGATÓRIA (NUMERAÇÃO PROGRESSIVA)
1. INTRODUÇÃO (incluindo Objectivos, Metodologia e Problema se solicitado)
2. [CAPÍTULOS DE DESENVOLVIMENTO] (Cada capítulo é uma secção principal: 2., 3., 4...)
3. CONCLUSÃO
4. BIBLIOGRAFIA
(A numeração deve ser sequencial e lógica. Não use o título "DESENVOLVIMENTO" como um cabeçalho único, use os títulos dos capítulos diretamente como secções principais).

📌 ESTILO E TOM
- Linguagem formal, técnica e puramente acadêmica, inspirada em teses e dissertações moçambicanas.
- Utilize conectores acadêmicos variados (Deste modo, Por outro lado, Sob esta ótica, Consequentemente, No que tange a).
- DESENVOLVIMENTO EXTENSO: Cada seção deve ser rica em detalhes, explicações teóricas e exemplos práticos.
- ESTRUTURA DE PARÁGRAFOS: Use parágrafos bem estruturados e coesos. Evite frases soltas.
- CITAÇÕES: Inclua citações indiretas no texto (ex: Segundo Santos (2022)... ou (Batalhão, 2024)) para dar credibilidade.`;

// --- Components ---

const ChartRenderer = ({ tag }: { tag: string }) => {
  // Parse [GRAFICO: type, Title, Item1: Val1, Item2: Val2]
  const match = tag.match(/\[GRAFICO:\s*(bar|pie),\s*([^,]+),\s*(.+)\]/i);
  if (!match) return <div className="text-red-500 text-xs italic">Erro ao processar gráfico: Formato inválido</div>;

  const type = match[1].toLowerCase();
  const title = match[2].trim();
  const dataStr = match[3];
  
  try {
    const data = dataStr.split(',').map(item => {
      const parts = item.split(':');
      if (parts.length < 2) return null;
      const name = parts[0].trim();
      const value = parseFloat(parts[1].trim()) || 0;
      return { name, value };
    }).filter(Boolean) as { name: string; value: number }[];

    if (data.length === 0) return null;

    return (
      <div className="my-8 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
        <h4 className="text-xs font-bold mb-6 text-[#0071e3] uppercase tracking-widest border-b border-[#0077ed]/20 pb-2">{title}</h4>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#0071e3'
                  }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="value" fill="#0077ed" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#0077ed', '#0071e3', '#3399ff', '#005bb7', '#0077ed'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle" 
                  wrapperStyle={{ fontSize: '10px', fontWeight: 600, color: '#64748b', paddingTop: '20px' }}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
        <p className="mt-4 text-[10px] text-gray-400 italic font-medium">Fonte: Elaboração própria com base em dados simulados.</p>
      </div>
    );
  } catch (e) {
    return <div className="text-red-500 text-xs italic">Erro ao renderizar gráfico</div>;
  }
};

const AttachmentImageRenderer = ({ tag, coverData }: { tag: string, coverData: CoverData }) => {
  const idMatch = tag.match(/\[IMAGEM_ANEXO:\s*(.*?)\]/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const attachment = coverData.additionalElements?.attachments?.find(a => a.id === id);
  if (!attachment || !attachment.image) return null;
  
  return (
    <div className="my-4 flex flex-col items-center gap-2">
      <img src={attachment.image} alt={attachment.title} className="max-w-full h-auto rounded-lg shadow-sm border border-gray-100" />
      {attachment.title && <p className="text-[0.4rem] italic text-gray-500 font-bold uppercase tracking-wider">Figura: {attachment.title}</p>}
    </div>
  );
};

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false, 
  isLoading = false,
  className = ""
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'action'; 
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}) => {
  const baseStyles = "px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-sm tracking-tight";
  const variants = {
    primary: "bg-[#0071e3] text-white hover:bg-[#0077ed] shadow-[0_4px_12px_rgba(0,113,227,0.15)] active:scale-[0.98]",
    secondary: "bg-white text-[#0071e3] hover:bg-[#f5faff] border border-[#d1e9ff] shadow-sm active:scale-[0.98]",
    outline: "border-2 border-[#0071e3]/10 text-[#0071e3] hover:bg-[#0071e3]/5 active:scale-[0.98]",
    action: "bg-[#0077ed] text-white hover:bg-[#0066cc] shadow-[0_4px_12px_rgba(0,119,237,0.2)] rounded-xl px-5 py-2"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
};

const drawChart = (doc: jsPDF, type: string, title: string, data: { label: string, value: number }[], x: number, y: number, width: number, height: number) => {
  const chartMargin = 10;
  const chartWidth = width - (chartMargin * 2);
  const chartHeight = height - (chartMargin * 2) - 10; // Space for title
  
  // Title
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), x + width / 2, y + 5, { align: "center" });
  
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barWidth = (chartWidth / data.length) * 0.7;
  const barGap = (chartWidth / data.length) * 0.3;
  
  if (type === 'bar') {
    data.forEach((d, i) => {
      const bHeight = (d.value / maxValue) * chartHeight;
      const bX = x + chartMargin + (i * (barWidth + barGap));
      const bY = y + height - chartMargin - bHeight;
      
      // Draw bar
      doc.setFillColor(50, 50, 50);
      doc.rect(bX, bY, barWidth, bHeight, 'F');
      
      // Label
      doc.setFont("times", "normal");
      doc.setFontSize(8);
      doc.text(d.label, bX + barWidth / 2, y + height - chartMargin + 5, { align: "center", maxWidth: barWidth + barGap });
      
      // Value
      doc.text(d.value.toString(), bX + barWidth / 2, bY - 2, { align: "center" });
    });
  } else if (type === 'pie') {
    const total = data.reduce((acc, d) => acc + d.value, 0);
    const centerX = x + width / 2;
    const centerY = y + height / 2 + 5;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    
    data.forEach((d, i) => {
      doc.setFontSize(8);
      const legendY = y + 15 + (i * 5);
      doc.setFillColor(50 + (i * 30), 50 + (i * 30), 50 + (i * 30));
      doc.rect(x + chartMargin, legendY - 3, 3, 3, 'F');
      doc.text(`${d.label}: ${d.value} (${Math.round((d.value/total)*100)}%)`, x + chartMargin + 5, legendY);
    });
    
    // Draw a simple circle to represent the pie
    doc.setDrawColor(0);
    doc.circle(centerX, centerY, radius, 'S');
  }
  
  return y + height + 10;
};

// --- Auth Page Component ---

const AuthPage = ({ 
  authMode, 
  setAuthMode, 
  handleLogin, 
  handleRegister,
  error,
  isLoading
}: { 
  authMode: 'login' | 'register', 
  setAuthMode: (mode: 'login' | 'register') => void,
  handleLogin: (e: React.FormEvent, data: any) => void,
  handleRegister: (e: React.FormEvent, data: any) => void,
  error: string | null,
  isLoading: boolean
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    password: ''
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4 font-sans selection:bg-black selection:text-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] bg-white/80 backdrop-blur-2xl rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white/40 p-10 md:p-12"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-xl"
          >
            <BookOpen className="text-white w-8 h-8" />
          </motion.div>
          <h1 className="text-[32px] font-semibold tracking-tight text-black mb-2">
            {authMode === 'login' ? 'Iniciar Sessão' : 'Criar Conta'}
          </h1>
          <p className="text-[#86868b] text-center text-[17px] leading-relaxed">
            {authMode === 'login' 
              ? 'Bem-vindo de volta ao Assistente Acadêmico.' 
              : 'Junte-se a nós para criar trabalhos perfeitos.'}
          </p>
          <div className="mt-4 flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Acesso Seguro</span>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </motion.div>
        )}

        <form onSubmit={(e) => authMode === 'login' ? handleLogin(e, formData) : handleRegister(e, formData)} className="space-y-4">
          <AnimatePresence mode="wait">
            {authMode === 'register' && (
              <motion.div 
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4 overflow-hidden pb-2"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Nome</label>
                  <div className="relative group">
                      <input 
                        required
                        type="text"
                        placeholder="Ex: João"
                        className="w-full bg-white border border-slate-300 rounded-2xl px-5 py-3.5 text-xs text-slate-500 italic placeholder:text-slate-400 focus:border-[#0071e3] focus:ring-4 focus:border-[#0071e3]/5 transition-all outline-none shadow-sm"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Apelido</label>
                  <div className="relative group">
                      <input 
                        required
                        type="text"
                        placeholder="Ex: Mambo"
                        className="w-full bg-white border border-slate-300 rounded-2xl px-5 py-3.5 text-xs text-slate-500 italic placeholder:text-slate-400 focus:border-[#0071e3] focus:ring-4 focus:border-[#0071e3]/5 transition-all outline-none shadow-sm"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Número de Celular</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0071e3] transition-colors">
                <Smartphone size={18} />
              </div>
              <input 
                required
                type="tel"
                placeholder="Ex: 841234567"
                className="w-full bg-white border border-slate-300 rounded-2xl pl-14 pr-5 py-3.5 text-xs text-slate-500 italic placeholder:text-slate-400 focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/5 transition-all outline-none shadow-sm"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
            {authMode === 'register' && (
              <p className="text-[11px] text-slate-400 leading-tight mt-2 px-1">
                <span className="font-bold text-[#0071e3]">Nota:</span> Use o número para pagamentos via <span className="text-slate-600">M-Pesa ou e-Mola</span>.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Palavra-passe</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#0071e3] transition-colors">
                <Lock size={18} />
              </div>
              <input 
                required
                type="password"
                placeholder="••••••••"
                className="w-full bg-white border border-slate-300 rounded-2xl pl-14 pr-5 py-3.5 text-xs text-slate-500 italic placeholder:text-slate-400 focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/5 transition-all outline-none shadow-sm"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01, translateY: -1 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0071e3] text-white rounded-2xl py-4 text-[16px] font-bold mt-6 shadow-lg shadow-[#0071e3]/20 hover:bg-[#0077ed] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : authMode === 'login' ? (
              <>
                Entrar <LogIn size={18} />
              </>
            ) : (
              <>
                Criar Conta <UserPlus size={18} />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100 text-center">
          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-[14px] text-[#0071e3] hover:text-[#0077ed] font-bold transition-colors"
          >
            {authMode === 'login' 
              ? 'Não tem uma conta? Crie uma agora' 
              : 'Já tem uma conta? Inicie sessão'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<Step>('cover_data');
  const [savedWorks, setSavedWorks] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);

  const [coverData, setCoverData] = useState<CoverData>({
    institution: '',
    faculty: '',
    course: '',
    topic: '',
    subTopics: [],
    studentName: '',
    studentNumber: '',
    studentClass: '',
    studentSection: '',
    subject: '',
    studentType: 'individual',
    studentList: [],
    professorName: '',
    academicYear: '',
    devPages: 10,
    location: '',
    month: new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(new Date()),
    year: new Date().getFullYear().toString(),
    logo: undefined,
    institutionType: 'university',
    showFolhaDeRosto: true,
    bulletStyle: 'bolas',
    allowChartsAndTables: false,
    additionalElements: {
      tables: [],
      charts: [],
      attachments: []
    }
  });
  const [groupMemberInput, setGroupMemberInput] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingExtra, setIsGeneratingExtra] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSection, setPreviewSection] = useState<Section | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  useEffect(() => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY não encontrada no ambiente do cliente.");
      setApiKeyMissing(true);
    }
  }, []);
  const [copied, setCopied] = useState(false);

  const aiRef = useRef<GoogleGenAI | null>(null);

  // --- Firebase Auth Listener ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Try to get user doc
          let userDoc = await getDoc(doc(db, 'users', user.uid));
          
          // If it doesn't exist, wait a bit and try again (might be a race condition during registration)
          if (!userDoc.exists()) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            userDoc = await getDoc(doc(db, 'users', user.uid));
          }

          if (userDoc.exists()) {
            setCurrentUser(userDoc.data() as User);
            setIsAuthenticated(true);
          } else {
            // If it still doesn't exist, it might be a new user still being created
            // We'll let handleRegister handle the initial state
            console.log("User doc not found yet, waiting for registration to complete...");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // --- Validate Connection to Firestore ---
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // --- Load User Works ---
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const q = query(collection(db, 'works'), where('userId', '==', currentUser.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const works = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSavedWorks(works);
      }, (error) => {
        console.error("Erro ao carregar trabalhos:", error);
      });
      return () => unsubscribe();
    }
  }, [isAuthenticated, currentUser]);

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('academic_premium_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Defensive check to ensure all required fields exist
        const sanitized = {
          ...parsed,
          subTopics: Array.isArray(parsed.subTopics) ? parsed.subTopics : [],
          studentList: Array.isArray(parsed.studentList) ? parsed.studentList : [],
          additionalElements: {
            tables: Array.isArray(parsed.additionalElements?.tables) ? parsed.additionalElements.tables : [],
            charts: Array.isArray(parsed.additionalElements?.charts) ? parsed.additionalElements.charts : [],
            attachments: Array.isArray(parsed.additionalElements?.attachments) ? parsed.additionalElements.attachments : []
          }
        };
        setCoverData(prev => ({ ...prev, ...sanitized }));
      } catch (e) {
        console.error("Erro ao carregar dados salvos:", e);
      }
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (coverData.topic || coverData.institution || coverData.studentName) {
      localStorage.setItem('academic_premium_data', JSON.stringify(coverData));
    }
  }, [coverData]);

  useEffect(() => {
    if (process.env.GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }, []);

  // --- Auth Handlers ---

  const handleLogin = async (e: React.FormEvent, data: any) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Use masked email for phone-based login
      const maskedEmail = `${data.phone}@mzdoc.app`;
      await signInWithEmailAndPassword(auth, maskedEmail, data.password);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("O método de login (E-mail/Senha) não está ativado no Firebase Console. Por favor, ative-o nas configurações do projeto.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Número ou palavra-passe incorretos.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Muitas tentativas falhadas. Tente mais tarde.");
      } else {
        setError("Erro ao iniciar sessão. Verifique a sua ligação.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent, data: any) => {
    e.preventDefault();
    
    if (data.password.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!data.phone || data.phone.length < 8) {
      setError("Introduza um número de celular válido.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Use masked email for phone-based registration
      const maskedEmail = `${data.phone}@mzdoc.app`;
      const userCredential = await createUserWithEmailAndPassword(auth, maskedEmail, data.password);
      const user = userCredential.user;

      const userData: User = {
        uid: user.uid,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: maskedEmail,
        role: 'user'
      };

      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        createdAt: serverTimestamp()
      });

      setCurrentUser(userData);
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("O método de registo não está ativado no Firebase. O administrador precisa de ativar 'E-mail/Senha' no Firebase Console.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este número já está registado.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Número inválido.");
      } else if (err.code === 'auth/weak-password') {
        setError("A palavra-passe é muito fraca.");
      } else {
        setError(err.message || "Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setStep('cover_data');
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore, if not create
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        const [firstName, ...lastNameParts] = (user.displayName || "Usuário").split(" ");
        const userData: User = {
          uid: user.uid,
          firstName: firstName,
          lastName: lastNameParts.join(" ") || "mzdoc",
          phone: "",
          email: user.email || "",
          role: 'user'
        };
        await setDoc(doc(db, 'users', user.uid), {
          ...userData,
          createdAt: serverTimestamp()
        });
        setCurrentUser(userData);
      } else {
        setCurrentUser(userDoc.data() as User);
      }
      setIsAuthenticated(true);
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError("O popup foi bloqueado pelo navegador. Por favor, permita popups.");
      } else {
        setError("Erro ao entrar com Google. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };


  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthPage 
        authMode={authMode} 
        setAuthMode={setAuthMode} 
        handleLogin={handleLogin} 
        handleRegister={handleRegister} 
        error={error}
        isLoading={isLoading}
      />
    );
  }


  const handleSaveData = async () => {
    if (!currentUser) return;
    setSaveStatus('saving');
    try {
      const workData = {
        userId: currentUser.uid,
        topic: coverData.topic,
        coverData: coverData,
        sections: sections,
        updatedAt: serverTimestamp()
      };

      // Check if we already have a work with this topic to update, or create new
      const existingWork = savedWorks.find(w => w.topic === coverData.topic);
      
      if (existingWork) {
        await setDoc(doc(db, 'works', existingWork.id), workData, { merge: true });
      } else {
        await addDoc(collection(db, 'works'), {
          ...workData,
          createdAt: serverTimestamp()
        });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("Erro ao salvar dados:", e);
      try {
        handleFirestoreError(e, OperationType.WRITE, 'works');
      } catch (firestoreErr: any) {
        setError("Erro ao salvar: Você não tem permissão ou houve um erro de conexão.");
      }
      setSaveStatus('idle');
    }
  };

  // Utility to fix common spacing issues in generated text
  const cleanGeneratedText = (text: string) => {
    if (!text) return '';
    return text
      // Remove all bold markers (**) as requested by user
      .replace(/\*\*/g, '')
      // Fix cases where bold title is stuck to content: "**Título**Conteúdo" -> "**Título** Conteúdo" (though ** are gone now, we keep logic for safety)
      .replace(/\*\*([^*]+)\*\*([A-ZÀ-Úa-zà-ú])/g, '$1 $2')
      // Ensure space after punctuation if missing
      .replace(/([.!?|;:])([A-ZÀ-Úa-zà-ú])/g, '$1 $2')
      // Ensure space after comma if missing
      .replace(/,([A-ZÀ-Úa-zà-ú])/g, ', $1')
      // Ensure space after closing parenthesis
      .replace(/\)([A-ZÀ-Úa-zà-ú])/g, ') $1')
      // Remove double spaces but PRESERVE newlines
      .replace(/[^\S\r\n][^\S\r\n]+/g, ' ');
  };


  const getAI = () => {
    if (!aiRef.current) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("API Key não configurada.");
      aiRef.current = new GoogleGenAI({ apiKey: key });
    }
    return aiRef.current;
  };

  const romanize = (num: number) => {
    if (isNaN(num) || num <= 0) return '';
    const lookup: [string, number][] = [
      ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
      ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
      ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]
    ];
    let roman = '';
    let n = num;
    for (const [letter, value] of lookup) {
      while (n >= value) {
        roman += letter;
        n -= value;
      }
    }
    return roman;
  };

  const handleGenerateStructure = async () => {
    console.log("Iniciando geração de estrutura...");
    try {
      const studentName = coverData.studentName || '';
      const topic = coverData.topic || '';
      const institution = coverData.institution || '';
      const studentList = coverData.studentList || [];

      const hasStudent = coverData.studentType === 'individual' 
        ? studentName.trim().length > 0 
        : studentList.length > 0;

      if (!topic.trim() || !institution.trim() || !hasStudent) {
        console.warn("Validação falhou:", { topic: !!topic.trim(), institution: !!institution.trim(), hasStudent });
        setError("Por favor, preencha os campos obrigatórios: Tema, Instituição e Estudante(s).");
        return;
      }
      setIsLoading(true);
      setError(null);

      const dynamicSections: Section[] = [];
      
      // Mandatory Structure
      dynamicSections.push({ id: 'section-capa', title: 'Capa', type: 'capa', isGenerating: false });
      if (coverData.showFolhaDeRosto) {
        dynamicSections.push({ id: 'section-rosto', title: 'Folha de Rosto', type: 'rosto', isGenerating: false });
      }
      
      dynamicSections.push({ id: 'section-indice', title: 'Índice', type: 'indice', isGenerating: false });
      dynamicSections.push({ id: 'section-intro', title: 'Introdução', type: 'intro', isGenerating: false });
      dynamicSections.push({ id: 'section-obj', title: '1.1 Objectivos', type: 'obj', isGenerating: false });
      dynamicSections.push({ id: 'section-metod', title: '1.2 Metodologia', type: 'metod', isGenerating: false });
      dynamicSections.push({ id: 'section-prob', title: '1.3 Problema', type: 'prob', isGenerating: false });
      
      // Chapters based on devPages
      const devPages = coverData.devPages || 10;
      const numChapters = Math.max(3, Math.ceil(devPages / 2));
      console.log(`Gerando ${numChapters} capítulos para o tema: ${topic}`);
      
      // Generate real titles for development chapters
      const ai = getAI();
      const structurePrompt = `Gere uma lista de exatamente ${numChapters} títulos de capítulos de desenvolvimento para um trabalho acadêmico sobre o tema "${topic}". 
      IMPORTANTE: Evite redundância. NÃO repita o tema principal "${topic}" em todos os títulos. Use títulos curtos, profissionais e que cubram diferentes aspectos do tema de forma criativa.
      Retorne APENAS os títulos, um por linha, sem numeração, sem introduções ou explicações.`;
      
      const structureResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: structurePrompt,
        config: {
          systemInstruction: "Você é um especialista em estruturação de trabalhos acadêmicos. Retorne apenas a lista solicitada.",
        }
      });
      
      const responseText = structureResponse.text || "";
      console.log("Resposta da IA recebida:", responseText);

      const titles = responseText
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .map(t => t.replace(/^(Capítulo|Chapter|Desenvolvimento|Secção)\s*\d*[:.-]?\s*/i, '')) // Clean up prefixes
        .map(t => cleanGeneratedText(t)) // Clean spacing in titles
        .slice(0, numChapters);
      
      // Fallback if AI fails to provide enough titles
      while (titles.length < numChapters) {
        titles.push(`Desenvolvimento: Parte ${titles.length + 1}`);
      }

      // Add Chapters as main sections starting from 2
      for (let i = 0; i < numChapters; i++) {
        const chapterTitle = titles[i] || `Parte ${i + 1}`;
        dynamicSections.push({ 
          id: `section-cap-${i + 1}`, 
          title: `CAPÍTULO ${romanize(i + 1)} - ${chapterTitle.toLowerCase()}`, 
          type: 'dev',
          isGenerating: false 
        });
      }
      
      dynamicSections.push({ id: 'section-concl', title: `Conclusão`, type: 'concl', isGenerating: false });
      dynamicSections.push({ id: 'section-sugest', title: 'Sugestões ou Recomendações', type: 'sugest', isGenerating: false });
      dynamicSections.push({ id: 'section-limit', title: 'Limitações do Estudo', type: 'limit', isGenerating: false });
      dynamicSections.push({ id: 'section-biblio', title: `Bibliografia`, type: 'biblio', isGenerating: false });
      
      // Add Anexos if there are additional elements
      if ((coverData.additionalElements?.tables?.length || 0) > 0 || 
          (coverData.additionalElements?.charts?.length || 0) > 0 || 
          (coverData.additionalElements?.attachments?.length || 0) > 0) {
        dynamicSections.push({ id: 'section-anexos', title: 'Anexos', type: 'anexos', isGenerating: false });
      }
      
      console.log("Estrutura gerada com sucesso. Mudando para o passo 'structure'.");
      setSections(dynamicSections);
      setStep('structure');
    } catch (err: any) {
      console.error("Erro em handleGenerateStructure:", err);
      let errorMessage = "Erro desconhecido";
      
      if (err && typeof err === 'object') {
        errorMessage = err.message || JSON.stringify(err);
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      if (errorMessage.includes("API Key")) {
        setError("Erro de configuração: API Key não encontrada. Por favor, verifique as configurações do projeto.");
      } else if (errorMessage.includes("model")) {
        setError("Erro de modelo: O modelo de IA selecionado não está disponível no momento.");
      } else {
        setError(`Erro ao definir estrutura: ${errorMessage.substring(0, 100)}. Verifique sua conexão com a internet e tente novamente.`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSection = async (sectionId: string) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) return;

    const section = sections[sectionIndex];
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, isGenerating: true } : s));
    setError(null);

    let content = "";

    try {
      const ai = getAI();
      const level = coverData.institutionType === 'university' ? 'Nível Superior (Universitário)' : 'Nível Secundário (Escola Secundária)';
      const subtopicsText = coverData.subTopics.length > 0 ? ` (Subtemas: ${coverData.subTopics.filter(s => s.trim()).join(', ')})` : '';
      
      const bulletMap = {
        'bolas': '• (Bolas)',
        'setas': '→ (Setas)',
        'selecao': '✓ (Seleção/Checkmark)'
      };
      const chosenBullet = bulletMap[coverData.bulletStyle] || '• (Bolas)';

      const isScientificSubject = ['matemática', 'física', 'química', 'biologia', 'estatística', 'contabilidade', 'economia', 'finanças'].some(s => 
        (coverData.subject?.toLowerCase().includes(s)) || 
        (coverData.topic?.toLowerCase().includes(s)) ||
        (coverData.course?.toLowerCase().includes(s))
      );

      let prompt = `Gere o conteúdo completo para a seção "${section.title}" do trabalho acadêmico de ${level} sobre o tema "${coverData.topic}${subtopicsText}".
      O conteúdo deve ser formal, acadêmico e seguir as normas moçambicanas.
      ${isScientificSubject ? 'IMPORTANTE: Como este é um trabalho de área técnica/científica, você DEVE incluir fórmulas, cálculos detalhados passo a passo e exemplos práticos resolvidos onde for aplicável.' : ''}
      IMPORTANTE: Evite redundância de palavras nos títulos e subtítulos internos. Garanta que haja sempre um espaço após pontos finais, vírgulas e pontos e vírgulas. Nunca junte frases sem espaço.
      REGRAS DE FORMATAÇÃO:
      1. NÃO repita o título da seção no início do texto. Comece diretamente com o desenvolvimento.
      2. Use negrito (**texto**) for todos os subtítulos internos que criar.
      3. Todo o texto deve estar alinhado à esquerda (sem recuo na primeira linha).
      4. LISTAS E MARCADORES: Use OBRIGATORIAMENTE o marcador "${chosenBullet}" para todas as listas. NÃO use outros símbolos.
      5. Listas e pontos de enumeração devem ter um pequeno recuo.
      Foque exclusivamente nesta seção.
      Não inclua saudações ou explicações, vá direto ao conteúdo acadêmico.`;

      const students = coverData.studentType === 'individual' 
        ? `${coverData.studentName}${coverData.studentNumber ? ` (${coverData.institutionType === 'university' ? 'Código' : 'Nº'}: ${coverData.studentNumber})` : ''}`
        : `${coverData.studentList.join(', ')}`;

      if (section.type === 'capa' || (section.title && section.title.toLowerCase().includes('capa'))) {
        prompt = `Gere uma CAPA acadêmica moçambicana formal com os seguintes dados:
        1. Nome da Instituição: ${coverData.institution} (Sempre no topo, centralizado)
        2. Título do Trabalho: ${coverData.topic.toUpperCase()} (No centro, em negrito e maiúsculas)
        3. Dados do Aluno (Alinhados à direita ou centralizados abaixo do título):
           - Nome: ${coverData.studentType === 'individual' ? coverData.studentName : coverData.studentList.join(', ')}
           - Faculdade: ${coverData.faculty || '(Gere um nome de faculdade coerente)'}
           - Curso: ${coverData.course}
           - Ano: ${coverData.academicYear || 'N/A'}
           - Cadeira (Disciplina): ${coverData.subject}
           - Código do Estudante: ${coverData.studentNumber || 'N/A'}
        4. Local e Ano (No fundo): ${coverData.location}, ${coverData.year}
        
        Formate como uma capa profissional moçambicana.`;
      } else if (section.type === 'rosto' || (section.title && section.title.toLowerCase().includes('folha de rosto'))) {
        prompt = `Gere uma FOLHA DE ROSTO acadêmica moçambicana formal com os seguintes dados:
        1. Nome da Instituição: ${coverData.institution} (No topo)
        2. Tema: ${coverData.topic}
        3. Subtemas: ${coverData.subTopics.filter(s => s.trim()).join(', ')}
        4. Ano de Frequência: ${coverData.academicYear || 'N/A'}
        5. Docente: ${coverData.professorName}
        6. Nota de Submissão: "Trabalho de carácter avaliativo da ${coverData.institutionType === 'university' ? 'cadeira' : 'disciplina'} ${coverData.subject}, submetido ao Docente ${coverData.professorName}, como requisito parcial de avaliação."
        7. Local e Ano: ${coverData.location}, ${coverData.year}
        
        Formate como uma folha de rosto profissional moçambicana.`;
      } else if (section.type === 'intro' || section.title.toLowerCase().includes('introdução')) {
        prompt = `Gere a INTRODUÇÃO para um trabalho acadêmico sobre o tema "${coverData.topic}".
        
        REGRAS OBRIGATÓRIAS:
        1. Extensão: MÁXIMO 12 LINHAS. Seja conciso e direto.
        2. Estrutura:
           - Contextualização ampla do tema.
           - Justificativa da escolha do tema.
           - Problematização.
           - Estrutura do trabalho.
        3. Estilo: Acadêmico moçambicano, formal e direto.
        4. NÃO use títulos internos, saudações ou explicações. Comece diretamente com o texto.
        5. Linguagem: Formal.`;
      } else if (section.type === 'obj' || section.title.toLowerCase().includes('objectivos')) {
        prompt = `Gere os OBJECTIVOS do trabalho de forma BEM RESUMIDA e DIRETA.
        1. Objectivo Geral: Uma frase única e ampla.
        2. Objectivos Específicos: Uma lista curta de 3 itens com verbos no infinitivo.
        Seja extremamente conciso.`;
      } else if (section.type === 'metod' || section.title.toLowerCase().includes('metodologia')) {
        prompt = `Gere a METODOLOGIA de forma BEM RESUMIDA (máximo 10-15 linhas).
        Descreva de forma direta: Tipo de pesquisa, métodos e técnicas de recolha de dados.
        Seja conciso e acadêmico.`;
      } else if (section.type === 'dev' || section.title.toLowerCase().includes('capítulo') || section.title.includes('2.')) {
        const isMainDev = section.title.toUpperCase().includes('2. DESENVOLVIMENTO');
        
        if (isMainDev) {
          prompt = `Gere uma breve abertura teórica para a seção de DESENVOLVIMENTO do trabalho sobre "${coverData.topic}".
          Esta parte serve como introdução ao corpo do trabalho.
          Texto formal, acadêmico moçambicano, sem subtítulos internos.
          Extensão: 1 a 2 parágrafos.`;
        } else {
          prompt = `Você é o módulo "DESENVOLVIMENTO DO TRABALHO" para a seção específica "${section.title}" sobre o tema "${coverData.topic}".
          
          Sua tarefa é gerar o conteúdo seguindo estas regras:
          
          1. CONTEÚDO:
             - Explicação detalhada, conceitos fundamentais e informações teóricas sobre este tópico.
             - Contexto relevante e exemplos práticos.
             ${isScientificSubject ? '- Como este é um tópico técnico/científico, inclua OBRIGATORIAMENTE fórmulas, cálculos passo a passo e exemplos de aplicação prática.' : ''}
             - Use linguagem acadêmica moçambicana, clara e objetiva.
             - Use conectores acadêmicos (Assim, Deste modo, Portanto, Contudo, Nesse contexto).
          
          2. EXTENSÃO:
             - Entre 2 a 4 parágrafos.
             - Entre 12 a 25 linhas de texto.
          
          3. FORMATAÇÃO:
             - NÃO use saudações ou explicações.
             - Comece diretamente com o texto.
             - NÃO repita o título da seção no início.
          
          4. ELEMENTOS VISUAIS:
             ${coverData.allowChartsAndTables 
               ? '- Se relevante, inclua uma TABELA (Markdown) ou um GRÁFICO [GRAFICO: ...] para ilustrar os dados.' 
               : '- NÃO inclua tabelas ou gráficos nesta seção. Forneça apenas texto acadêmico.'}
          
          Evite repetições e opiniões pessoais.`;
        }
      } else if (section.type === 'concl' || section.title.toLowerCase().includes('conclusão')) {
        prompt = `Você é o gerador oficial de CONCLUSÕES para trabalhos acadêmicos moçambicanos sobre o tema "${coverData.topic}".
        
        Sua tarefa é produzir a conclusão seguindo estas regras:
        
        1. ESTRUTURA E EXTENSÃO:
           - O texto deve ter entre 1 e 2 parágrafos.
           - No total, deve ter entre 7 e 12 linhas.
           - Estilo formal, direto e acadêmico.
        
        2. CONTEÚDO OBRIGATÓRIO:
           - Síntese geral do tema: Retome o tema de forma resumida e o que foi estudado.
           - Principais pontos abordados: Resuma ideias centrais e contribuições do trabalho.
           - Relevância: Mencione a importância do tema para o conhecimento, sociedade ou disciplina.
           - Encerramento acadêmico: Use uma frase final como "Deste modo, conclui-se que...", "Em suma, o presente trabalho permitiu compreender que..." ou "Portanto, considera-se que...".
        
        3. LINGUAGEM E ESTILO:
           - Tom formal e objetivo, vocabulário acadêmico simples.
           - Coesão e coerência, sem opiniões pessoais exageradas.
           - NÃO use saudações, explicações ou o título "CONCLUSÃO" no início do texto. Comece diretamente com o parágrafo.
        
        Siga rigorosamente o padrão acadêmico moçambicano.`;
      } else if (section.type === 'prob' || section.title.toLowerCase().includes('problema')) {
        prompt = `Gere o PROBLEMA do estudo.
        Deve ser formulado em forma de pergunta clara e objetiva sobre o tema "${coverData.topic}".
        Exemplo: Quais são os principais desafios enfrentados pela instituição X?`;
      } else if (section.type === 'sugest' || section.title.toLowerCase().includes('sugestões')) {
        prompt = `Gere SUGESTÕES OU RECOMENDAÇÕES baseadas na conclusão do trabalho sobre "${coverData.topic}".
        Deve ser uma lista objetiva de ações recomendadas.`;
      } else if (section.type === 'limit' || section.title.toLowerCase().includes('limitações')) {
        prompt = `Gere as LIMITAÇÕES DO ESTUDO.
        Descreva dificuldades reais ou prováveis encontradas durante a pesquisa sobre "${coverData.topic}".`;
      } else if (section.type === 'indice' || section.title.toLowerCase().includes('índice')) {
        const sectionTitles = sections.map(s => s.title).join('\n');
        prompt = `Você é o gerador automático do ÍNDICE para um trabalho acadêmico moçambicano sobre o tema "${coverData.topic}".
        
        Sua tarefa é produzir o Sumário seguindo estas regras:
        
        1. ESTRUTURA:
           - O Índice deve conter todas as partes do trabalho.
           - Use o modelo acadêmico moçambicano: Inclua títulos e subtítulos.
           - Use a numeração sequencial das secções (1, 1.1, 1.2, 2, 2.1...).
           - Formate com pontos de guia (dots) e números de página fictícios (ex: 1, 2, 3...) para visualização.
        
        2. FORMATAÇÃO:
           - NÃO use saudações ou explicações.
           - Comece diretamente com a lista.
           - Use apenas o texto das secções.
        
        Aqui estão as secções atuais do trabalho:
        ${sectionTitles}
        
        Gere o Índice formatado corretamente.`;
      } else if (section.type === 'anexos' || section.title.toLowerCase().includes('anexos')) {
        let additionalContent = "";
        
        // Add pre-defined tables
        (coverData.additionalElements?.tables || []).forEach(t => {
          additionalContent += `\n\n### ${t.title}\n${t.content}`;
        });
        
        // Add pre-defined charts
        (coverData.additionalElements?.charts || []).forEach(c => {
          const dataStr = c.data.map(d => `${d.label}:${d.value}`).join(',');
          additionalContent += `\n\n### ${c.title}\n[GRAFICO: ${c.type}, ${c.title}, ${dataStr}]`;
        });
        
        // Add pre-defined attachments
        (coverData.additionalElements?.attachments || []).forEach(a => {
          additionalContent += `\n\n### ${a.title}\n${a.text || ''}`;
          if (a.image) {
            additionalContent += `\n[IMAGEM_ANEXO: ${a.id}]`;
          }
        });

        if (additionalContent) {
          content = "Abaixo apresentam-se os anexos e elementos complementares deste trabalho:" + additionalContent;
        } else {
          prompt = `Gere uma seção de ANEXOS.
          Liste documentos complementares que seriam úteis para este trabalho sobre "${coverData.topic}" (ex: Questionários, Mapas, Tabelas de Dados Brutos).`;
        }
      } else if (section.type === 'biblio' || section.title.toLowerCase().includes('bibliografia')) {
        prompt = `Você é o gerador automático da BIBLIOGRAFIA para um trabalho acadêmico moçambicano sobre o tema "${coverData.topic}".
        
        Sua tarefa é gerar entre 3 e 6 referências bibliográficas seguindo estas regras:
        
        1. FORMATO DAS REFERÊNCIAS:
           - Livros: APELIDO, Nome. Título do livro. Cidade: Editora, Ano.
           - Artigos: APELIDO, Nome. “Título do artigo.” Nome da revista, volume(número), páginas, Ano.
           - Websites: APELIDO ou ENTIDADE. Título da página. Disponível em: URL. Acesso em: dia mês ano.
           - Leis/Documentos: MOÇAMBIQUE. Nome da lei ou documento. Ano.
        
        2. REGRAS DE ORGANIZAÇÃO:
           - Ordene por ordem alfabética do apelido do autor.
           - Use fontes plausíveis e coerentes com o tema.
           - Use URLs institucionais conhecidas (UNICEF, UNESCO, OMS, INE Moçambique, Governo de Moçambique).
        
        3. FORMATAÇÃO:
           - NÃO use saudações ou explicações.
           - NÃO use o título "BIBLIOGRAFIA" no início.
           - Cada referência deve estar em uma nova linha.
        
        Gere apenas a lista de referências formatada.`;
      }

      if (!content) {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          }
        });

        content = response.text || "";
      }
      
      // Limpeza defensiva de prefixos conversacionais comuns da IA
      content = content.replace(/^(Aqui está|Certamente|Com certeza|Para a|Nesta seção|Gerei|Segue a|Como solicitado|De acordo com).*?[:\n]/i, "").trim();
      
      // Clean spacing issues
      content = cleanGeneratedText(content);

      // Remove redundant title if it appears at the beginning
      const titleClean = section.title.replace(/^\d+\.\s*/, '').trim();
      const lines = content.split('\n');
      if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // Check if first line is exactly the title or a numbered version of it
        const isRedundant = 
          firstLine.toLowerCase() === titleClean.toLowerCase() || 
          firstLine.toLowerCase() === section.title.toLowerCase() ||
          (firstLine.match(/^\d+\.?\s+/) && firstLine.toLowerCase().includes(titleClean.toLowerCase()));
        
        if (isRedundant) {
          content = lines.slice(1).join('\n').trim();
        }
      }

      if (!content || content.length < 10) {
        throw new Error("A IA não retornou conteúdo suficiente para esta seção.");
      }

      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, content, isGenerating: false } : s));
    } catch (err) {
      console.error(err);
      setError(`Erro ao gerar a seção ${section.title}. Por favor, tente novamente.`);
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, isGenerating: false } : s));
    }
  };

  const handleGenerateExtra = async (sectionId: string, type: 'table' | 'chart') => {
    setIsGeneratingExtra(`${sectionId}-${type}`);
    try {
      const ai = getAI();
      const section = sections.find(s => s.id === sectionId);
      if (!section) return;

      const prompt = type === 'table' 
        ? `Gere uma tabela académica em Markdown relevante para a secção "${section.title}" do trabalho sobre "${coverData.topic}". A tabela deve conter dados fictícios mas realistas e profissionais. Retorne APENAS a tabela em Markdown.`
        : `Gere um gráfico académico relevante para a secção "${section.title}" do trabalho sobre "${coverData.topic}". Use a tag: [GRAFICO: tipo, Título, Item1: Valor1, Item2: Valor2]. Escolha entre tipo 'bar' ou 'pie'. Retorne APENAS a tag do gráfico.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        }
      });

      const extraContent = cleanGeneratedText(response.text || "");
      setSections(prev => prev.map(s => 
        s.id === sectionId 
          ? { ...s, content: (s.content || "") + "\n\n" + extraContent } 
          : s
      ));
      if (previewSection?.id === sectionId) {
        setPreviewSection(prev => prev ? { ...prev, content: (prev.content || "") + "\n\n" + extraContent } : null);
      }
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
    } finally {
      setIsGeneratingExtra(null);
    }
  };

  const handleGenerateAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Generate all sections except Index first
      const otherSections = sections.filter(s => !s.content && !s.title.toLowerCase().includes('índice'));
      for (const section of otherSections) {
        await handleGenerateSection(section.id);
      }
      
      // Generate Index last
      const indexSection = sections.find(s => !s.content && s.title.toLowerCase().includes('índice'));
      if (indexSection) {
        await handleGenerateSection(indexSection.id);
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao gerar todas as seções.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    setStep('payment');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText('878404244');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateAndDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF();
      
      // Margins in mm
      const marginTop = 30;
      const marginBottom = 25;
      const marginLeft = 30;
      const marginRight = 25;
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - marginLeft - marginRight;
      const lineHeight = 1.5 * 5; // 1.5 spacing
      
      let y = marginTop;
      let currentPage = 0; // Will start at 1 on first addPage
      let actualPageNumber = 0; // For display numbering
      const indexEntries: { title: string, page: number, isSub: boolean, isChapter: boolean }[] = [];

      // Helper to add a new page with margins and numbering
      const addNewPage = (showNumber = false) => {
        doc.addPage();
        currentPage++;
        if (showNumber) {
          actualPageNumber++;
          doc.setFont("times", "normal");
          doc.setFontSize(10);
          doc.text(`${actualPageNumber}`, pageWidth - marginRight, pageHeight - 15, { align: "right" });
        }
        return marginTop;
      };

      // Helper for justified text (No indentation as requested)
      const addJustifiedText = (text: string, x: number, currentY: number, width: number) => {
        const lines = doc.splitTextToSize(text, width);
        let i = 0;
        
        while (i < lines.length) {
          const availableHeight = pageHeight - marginBottom - currentY;
          const linesThatFit = Math.floor(availableHeight / lineHeight);
          
          if (linesThatFit <= 0) {
            currentY = addNewPage(currentPage >= (coverData.showFolhaDeRosto ? 3 : 2));
            continue;
          }

          // Widow/Orphan protection
          let linesToPrint = linesThatFit;
          const remainingLines = lines.length - i;

          if (linesToPrint < remainingLines) {
            // If we can only fit 1 line, and there are more, move to next page
            if (linesToPrint < 2) {
              currentY = addNewPage(currentPage >= (coverData.showFolhaDeRosto ? 3 : 2));
              continue;
            }
            // If printing linesToPrint would leave only 1 line for the next page
            if (remainingLines - linesToPrint < 2) {
              // Reduce linesToPrint so the next page has at least 2 lines
              linesToPrint = Math.max(0, remainingLines - 2);
              if (linesToPrint === 0) {
                currentY = addNewPage(currentPage >= (coverData.showFolhaDeRosto ? 3 : 2));
                continue;
              }
            }
          } else {
            linesToPrint = remainingLines;
          }
          
          const chunk = lines.slice(i, i + linesToPrint);
          const isLastChunk = (i + chunk.length) === lines.length;
          
          if (isLastChunk) {
            // Standard behavior: justify all but the last line of the paragraph
            doc.text(chunk, x, currentY, { 
              align: "justify", 
              maxWidth: width,
              lineHeightFactor: 1.5
            });
          } else {
            // Not the last chunk: we need to justify ALL lines in this chunk
            // We add an empty string to trick jsPDF into justifying the "last" line of our chunk
            doc.text([...chunk, ""], x, currentY, { 
              align: "justify", 
              maxWidth: width,
              lineHeightFactor: 1.5
            });
          }
          
          currentY += chunk.length * lineHeight;
          i += chunk.length;
          
          if (i < lines.length) {
            currentY = addNewPage(currentPage >= (coverData.showFolhaDeRosto ? 3 : 2));
          }
        }
        
        return currentY + 5; // Extra space between paragraphs
      };

      // 1. Capa (Cover) - No page number
      // Draw Border (Moldura)
      doc.setDrawColor(0);
      doc.setLineWidth(0.529); // 1.5 pt
      doc.rect(15, 15, pageWidth - 30, pageHeight - 30);
      
      const coverLineHeight = 7;
      let currentCapaY = 35;

      // Top: Institution
      if (coverData.logo) {
        try {
          const logoWidth = 25;
          const logoHeight = 25;
          doc.addImage(coverData.logo, 'PNG', (pageWidth - logoWidth) / 2, currentCapaY, logoWidth, logoHeight);
          currentCapaY += logoHeight + 10;
        } catch (e) {
          console.error("Erro ao adicionar logo ao PDF:", e);
        }
      }

      // 1. Capa
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      if (coverData.institution) {
        doc.text(coverData.institution.toUpperCase(), pageWidth / 2, currentCapaY, { align: "center" });
        currentCapaY += 10;
      }

      doc.setFontSize(12);
      if (coverData.faculty) {
        doc.text(`FACULDADE: ${coverData.faculty.toUpperCase()}`, pageWidth / 2, currentCapaY, { align: "center" });
        currentCapaY += 7;
      }
      if (coverData.course) {
        doc.text(`CURSO: ${coverData.course.toUpperCase()}`, pageWidth / 2, currentCapaY, { align: "center" });
        currentCapaY += 7;
      }
      if (coverData.academicYear && coverData.institutionType === 'university') {
        doc.text(`ANO: ${coverData.academicYear.toUpperCase()}`, pageWidth / 2, currentCapaY, { align: "center" });
        currentCapaY += 7;
      }
      if (coverData.subject) {
        doc.text(`CADEIRA: ${coverData.subject.toUpperCase()}`, pageWidth / 2, currentCapaY, { align: "center" });
        currentCapaY += 7;
      }
      
      // Center: Topic
      const titleSectionY = pageHeight * 0.45;
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      if (coverData.topic) {
        const titleLines = doc.splitTextToSize(coverData.topic.toUpperCase(), contentWidth);
        doc.text(titleLines, pageWidth / 2, titleSectionY, { align: "center" });
      }

      // Bottom-ish: Student Data
      const studentDataY = pageHeight * 0.65;
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      let studentY = studentDataY;
      
      const addStudentLine = (label: string, value: string) => {
        if (!value) return;
        doc.setFont("times", "normal");
        const labelWidth = doc.getTextWidth(label);
        const valueWidth = doc.getTextWidth(value);
        const startX = (pageWidth - (labelWidth + valueWidth)) / 2;
        
        doc.text(label, startX, studentY);
        doc.text(value, startX + labelWidth, studentY);
        studentY += 7;
      };

      if (coverData.studentType === 'individual') {
        addStudentLine("Nome: ", coverData.studentName);
        addStudentLine("Código: ", coverData.studentNumber);
      } else {
        addStudentLine("Nomes: ", coverData.studentList.join(', '));
      }

      // Bottom: Location and Year
      const bottomSectionY = pageHeight - 35;
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      
      const dateParts = [];
      if (coverData.location) dateParts.push(coverData.location);
      if (coverData.month && coverData.year) {
        dateParts.push(`${coverData.month} de ${coverData.year}`);
      } else if (coverData.year) {
        dateParts.push(coverData.year);
      }
      const dateText = dateParts.join(', ');

      if (dateText) {
        doc.text(dateText, pageWidth / 2, bottomSectionY, { align: "center" });
      }
      
      // sectionPages['Capa'] = 1;

      // 2. Folha de Rosto - No page number
      if (coverData.showFolhaDeRosto) {
        y = addNewPage(false);
        let currentRostoY = 35;

        // Top: Institution
        if (coverData.logo) {
          try {
            const logoWidth = 25;
            const logoHeight = 25;
            doc.addImage(coverData.logo, 'PNG', (pageWidth - logoWidth) / 2, currentRostoY, logoWidth, logoHeight);
            currentRostoY += logoHeight + 10;
          } catch (e) {
            console.error("Erro ao adicionar logo à Folha de Rosto:", e);
          }
        }

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        if (coverData.institution) {
          doc.text(coverData.institution.toUpperCase(), pageWidth / 2, currentRostoY, { align: "center" });
        }

        // Center: Topic and Subtopics
        const rostoTitleY = pageHeight * 0.4;
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        if (coverData.topic) {
          const titleLines = doc.splitTextToSize(coverData.topic.toUpperCase(), contentWidth);
          doc.text(titleLines, pageWidth / 2, rostoTitleY, { align: "center" });
          
          if (coverData.subTopics.length > 0) {
            doc.setFont("times", "bolditalic");
            doc.setFontSize(12);
            let subY = rostoTitleY + (titleLines.length * 7) + 5;
            coverData.subTopics.filter(s => s.trim()).forEach(sub => {
              doc.text(`- ${sub}`, pageWidth / 2, subY, { align: "center" });
              subY += 7;
            });
          }
        }

        // Right side: Submission Note and Docente
        const submissionY = pageHeight * 0.6;
        const subWidth = contentWidth * 0.5;
        const subX = pageWidth - marginRight - subWidth;
        
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        const submissionText = `Trabalho de carácter avaliativo da ${coverData.institutionType === 'university' ? 'cadeira' : 'disciplina'} ${coverData.subject}, submetido ao Docente ${coverData.professorName}, como requisito parcial de avaliação.`;
        const subLines = doc.splitTextToSize(submissionText, subWidth);
        doc.text(subLines, subX, submissionY, { align: "justify", maxWidth: subWidth, lineHeightFactor: 1.5 });
        
        let docenteY = submissionY + (subLines.length * 6) + 10;
        doc.setFont("times", "normal");
        doc.text(`Docente: ${coverData.professorName}`, subX, docenteY);

        // Bottom: Location and Year
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        if (dateText) {
          doc.text(dateText, pageWidth / 2, bottomSectionY, { align: "center" });
        }
        
        // sectionPages['Folha de Rosto'] = 2;
      }

      // 3. Índice - Will be filled at the end to get correct page numbers
      y = addNewPage(false);
      const indexPage = coverData.showFolhaDeRosto ? 3 : 2;
      let lastIndexPage = indexPage;

      // 4. Other Sections - Numbering starts from Introduction
      let firstContentSection = true;

      sections.filter(s => !['Capa', 'Folha de Rosto', 'Índice'].includes(s.title) && s.content).forEach((section) => {
        const isSubSection = /^(\d+\.\d+)/.test(section.title);
        const isChapter = section.title.toUpperCase().includes('CAPÍTULO');
        
        // Major sections that should start on a new page
        const isMajorSection = ['intro', 'concl', 'biblio', 'anexos'].includes(section.type || '') || isChapter;

        // Only add a new page if it's a major section OR if it's the first content section
        if (firstContentSection || (isMajorSection && !isSubSection)) {
          y = addNewPage(true); // Start numbering from here
          firstContentSection = false;
        } else {
          // Add space before subsection/minor section if it's not starting a new page
          y += 10;
          // Check if we need a new page anyway due to space (Keep with next logic for titles)
          if (y > pageHeight - marginBottom - 35) {
            y = addNewPage(true);
          }
        }

        // Format title for index and display
        let displayTitle = section.title.replace(/\*\*/g, '').trim();
        const chapterMatch = displayTitle.match(/^(CAP[IÍ]TULO\s+[IVXLCDM]+)\s*-\s*(.*)/i);
        if (chapterMatch) {
          displayTitle = `${chapterMatch[1].toUpperCase()} - ${chapterMatch[2].toLowerCase()}`;
        } else if (!isSubSection) {
          displayTitle = displayTitle.toUpperCase();
        }

        indexEntries.push({ title: displayTitle, page: actualPageNumber, isSub: isSubSection, isChapter });
        
        // Title Rendering (All left-aligned and BOLD)
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        doc.text(displayTitle, marginLeft, y);
        y += 15;
        
        // Body (12pt, Normal, Times)
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        
        const content = section.content || '';
        
        // Split content into parts: text, tables, or charts
        // Split content into lines, but also handle cases where sub-points might be on the same line
        const rawLines = (section.content || '').split('\n');
        const lines: string[] = [];
        
        rawLines.forEach(l => {
          // If a line contains something like " 2.2 " or " 3.1.1 " in the middle, split it
          const parts = l.split(/\s+(?=\d+\.\d+(?:\.\d+)*\s+)/);
          if (parts.length > 1) {
            lines.push(...parts);
          } else {
            lines.push(l);
          }
        });

        let tableLines: string[] = [];
        let inTable = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          
          // Chart Detection
          if (line.startsWith('[GRAFICO:')) {
            // Finish any table before chart
            if (inTable && tableLines.length > 0) {
              y = renderTable(doc, tableLines, marginLeft, y, contentWidth);
              tableLines = [];
              inTable = false;
            }
            
            const match = line.match(/\[GRAFICO:\s*(bar|pie),\s*(.*?),\s*(.*?)\]/i);
            if (match) {
              const type = match[1].toLowerCase();
              const title = match[2];
              const dataStr = match[3];
              const data = dataStr.split(',').map(item => {
                const [label, val] = item.split(':').map(s => s.trim());
                return { label, value: parseFloat(val) || 0 };
              });
              
              if (y + 60 > pageHeight - marginBottom) y = addNewPage(true);
              y = drawChart(doc, type, title, data, marginLeft, y, contentWidth, 50);
            }
            continue;
          }

          // Image Detection
          if (line.startsWith('[IMAGEM_ANEXO:')) {
            const idMatch = line.match(/\[IMAGEM_ANEXO:\s*(.*?)\]/);
            if (idMatch) {
              const id = idMatch[1];
              const attachment = coverData.additionalElements?.attachments?.find(a => a.id === id);
              if (attachment && attachment.image) {
                if (y + 80 > pageHeight - marginBottom) y = addNewPage(true);
                try {
                  doc.addImage(attachment.image, 'JPEG', marginLeft, y, contentWidth, 70);
                  y += 75;
                } catch (e) {
                  console.error("Error adding image to PDF:", e);
                }
              }
            }
            continue;
          }

          // Table Detection
          if (line.startsWith('|') && line.endsWith('|')) {
            inTable = true;
            tableLines.push(line);
            continue;
          } else if (inTable) {
            // End of table
            y = renderTable(doc, tableLines, marginLeft, y, contentWidth);
            tableLines = [];
            inTable = false;
            if (line === '') continue;
          }

          // Subtitle Detection (e.g., 2.1 Contextualização or ### Subtitle or **Subtitle**)
          const subtitleMatch = line.match(/^(\d+\.\d+(\.\d+)*)\s+(.*)/) || 
                               line.match(/^#{2,6}\s+(.*)/) || 
                               line.match(/^\*\*(.*?)\*\*$/);
          const titleMatch = line.match(/^#\s+(.*)/);

          if (titleMatch) {
            if (y + 30 > pageHeight - marginBottom) y = addNewPage(true);
            const titleText = titleMatch[1].trim();
            doc.setFont("times", "bold");
            doc.setFontSize(14);
            doc.text(titleText.toUpperCase(), marginLeft, y);
            y += 12;
            doc.setFont("times", "normal");
            continue;
          }

          if (subtitleMatch) {
            // Finish any table before subtitle
            if (inTable && tableLines.length > 0) {
              y = renderTable(doc, tableLines, marginLeft, y, contentWidth);
              tableLines = [];
              inTable = false;
            }
            
            if (y + 25 > pageHeight - marginBottom) y = addNewPage(true);
            
            // Clean up subtitle text (remove markdown hashes and bold markers if present)
            const cleanSubtitle = line.replace(/^#{2,6}\s+/, '').replace(/\*\*/g, '').trim();
            
            // Format CAPITOLO for index
            let indexTitle = cleanSubtitle;
            const chapterMatch = indexTitle.match(/^(CAP[IÍ]TULO\s+[IVXLCDM]+)\s*-\s*(.*)/i);
            if (chapterMatch) {
              indexTitle = `${chapterMatch[1].toUpperCase()} - ${chapterMatch[2].toLowerCase()}`;
            }

            // Only add to index if it's not the same as the section title (to avoid duplicates)
            if (line.toLowerCase() !== section.title.toLowerCase()) {
              indexEntries.push({ title: indexTitle, page: actualPageNumber, isSub: true, isChapter: false });
            }
            
            doc.setFont("times", "bold");
            doc.setFontSize(12);
            doc.text(indexTitle, marginLeft, y);
            y += 10;
            doc.setFont("times", "normal");
            continue;
          }

          // List Item Detection
          if (line.startsWith('- ') || line.startsWith('* ')) {
            let iconObj = { f: 'times', c: '•' };
            if (coverData.bulletStyle === 'setas') {
              iconObj = { f: 'ZapfDingbats', c: 'i' };
            } else if (coverData.bulletStyle === 'selecao') {
              iconObj = { f: 'ZapfDingbats', c: '4' };
            }
            
            const cleanLine = line.substring(2)
              .replace(/<br\s*\/?>/gi, '')
              .replace(/\*\*Frase:?\*\*/gi, '')
              .replace(/#{1,6}\s/g, '')
              .replace(/\*\*/g, '')
              .replace(/\[(.*?)\]\(.*?\)/g, '$1')
              .trim();
            
            if (cleanLine !== '') {
              doc.setFont(iconObj.f as any, "normal");
              doc.text(iconObj.c, marginLeft, y);
              doc.setFont("times", "normal");
              y = addJustifiedText(cleanLine, marginLeft + 6, y, contentWidth - 6);
            }
            continue;
          }

          // Regular Paragraph
          if (line !== '') {
            const cleanLine = line
              .replace(/<br\s*\/?>/gi, '')
              .replace(/\*\*Frase:?\*\*/gi, '')
              .replace(/#{1,6}\s/g, '')
              .replace(/\*\*/g, '')
              .replace(/\[(.*?)\]\(.*?\)/g, '$1')
              .trim();
            
            if (cleanLine !== '') {
              y = addJustifiedText(cleanLine, marginLeft, y, contentWidth);
            }
          }
        }
        
        // Final table check
        if (inTable && tableLines.length > 0) {
          y = renderTable(doc, tableLines, marginLeft, y, contentWidth);
        }
      });

      // Helper to render table
      function renderTable(doc: jsPDF, lines: string[], x: number, y: number, width: number) {
        const rows = lines
          .filter(l => !l.includes('---')) // Skip separator line
          .map(l => l.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim()));
        
        if (rows.length < 1) return y;
        
        const head = [rows[0]];
        const body = rows.slice(1);
        
        autoTable(doc, {
          head: head,
          body: body,
          startY: y,
          margin: { left: x },
          tableWidth: width,
          styles: { font: "times", fontSize: 10 },
          headStyles: { fillColor: [100, 100, 100] },
          didDrawPage: (data) => {
            y = data.cursor?.y || y;
          }
        });
        
        return (doc as any).lastAutoTable.finalY + 10;
      }

      // Now go back to page 3 to fill the Index
      doc.setPage(indexPage);
      y = marginTop;
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("Índice", marginLeft, y);
      y += 15;
      
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      
      indexEntries.forEach((entry) => {
        if (y > pageHeight - marginBottom) {
          // If we need a new page for the index, insert it right after the current index page
          lastIndexPage++;
          doc.insertPage(lastIndexPage);
          doc.setPage(lastIndexPage);
          y = marginTop;
        }

        // Title is already cleaned and formatted when pushed to indexEntries
        let title = entry.title;
        
        const pageNum = entry.page.toString();
        const pageNumWidth = doc.getTextWidth(pageNum);
        // Ensure title doesn't overlap page number. Leave at least 15mm for dots and number.
        const maxTitleWidth = pageWidth - marginLeft - marginRight - pageNumWidth - 15;
        
        doc.setFont("times", "normal");
        
        // Truncate title if too long to prevent overlap
        if (doc.getTextWidth(title) > maxTitleWidth) {
          while (doc.getTextWidth(title + "...") > maxTitleWidth && title.length > 0) {
            title = title.substring(0, title.length - 1);
          }
          title = title + "...";
        }
        
        doc.text(title, marginLeft, y);
        
        // Draw dots
        const titleWidth = doc.getTextWidth(title);
        const dotStartX = marginLeft + titleWidth + 2;
        const dotEndX = pageWidth - marginRight - pageNumWidth - 1; // End dots very close to the page number
        
        if (dotEndX > dotStartX) {
          doc.setFont("times", "normal");
          const dotInterval = 1.5; // mm spacing between dots
          
          let currentDotX = dotEndX;
          while (currentDotX > dotStartX) {
            doc.text(".", currentDotX, y);
            currentDotX -= dotInterval;
          }
        }
        
        doc.setFont("times", "normal");
        doc.text(pageNum, pageWidth - marginRight, y, { align: "right" });
        
        y += 8;
      });

      doc.save(`${coverData.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      setError("Erro ao gerar o arquivo PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleRestart = () => {
    const saved = localStorage.getItem('academic_premium_data');
    let initialData: CoverData = {
      institution: '',
      faculty: '',
      course: '',
      topic: '',
      subTopics: [],
      studentName: '',
      studentNumber: '',
      studentClass: '',
      studentSection: '',
      subject: '',
      studentType: 'individual',
      studentList: [],
      professorName: '',
      academicYear: '',
      devPages: 10,
      location: '',
      month: new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(new Date()),
      year: new Date().getFullYear().toString(),
      logo: undefined,
      institutionType: 'university',
      showFolhaDeRosto: true,
      bulletStyle: 'bolas',
      allowChartsAndTables: false,
      additionalElements: {
        tables: [],
        charts: [],
        attachments: []
      }
    };

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialData = { ...initialData, ...parsed };
      } catch (e) {
        console.error("Erro ao carregar dados salvos no restart:", e);
      }
    }

    setCoverData(initialData);
    setSections([]);
    setStep('cover_data');
    setError(null);
    setGroupMemberInput('');
  };

  const handleDeleteSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const generatedCount = sections.filter(s => s.content).length;
  const totalSections = sections.length;
  const progressPercent = totalSections > 0 ? (generatedCount / totalSections) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col">
      {/* API Key Warning */}
      {apiKeyMissing && (
        <div className="fixed bottom-4 right-4 z-[200]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-xl max-w-xs"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900 mb-1">Configuração Incompleta</p>
                <p className="text-[10px] text-amber-700 leading-relaxed mb-2">
                  A chave de API (GEMINI_API_KEY) não foi encontrada. A geração de conteúdo não funcionará.
                </p>
                <p className="text-[9px] text-amber-600 italic">
                  Adicione-a no painel "Secrets" do AI Studio.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Elegant Header */}
      <header className="sticky top-0 z-50 w-full bg-white/2 backdrop-blur-3xl border-b border-slate-200/30 pt-4 pb-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Main Header: Profile & Actions */}
          <div className="w-full bg-white border border-slate-200/30 rounded-[24px] px-6 h-16 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.01)]">
            <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm">
                <img 
                  src="https://picsum.photos/seed/academic/200" 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="truncate">
                <h1 className="font-sans text-xs font-bold text-[#0071e3] tracking-tight truncate">
                  {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Onório Batalhão'}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-shrink-0">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 bg-white border border-slate-200/40 shadow-[0_2px_10px_rgb(0,0,0,0.01)] text-slate-400 hover:text-[#0071e3] hover:border-[#0071e3]/20 transition-all rounded-xl"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Floating Process Bar & Step Title */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="bg-white border border-slate-200/30 rounded-full px-4 h-11 flex items-center gap-2 shadow-sm overflow-hidden">
              {(['cover_data', 'structure', 'final'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-2 px-2 sm:px-3 py-1 rounded-full transition-all duration-500 ${step === s ? 'bg-[#0071e3]/5 ring-1 ring-[#0071e3]/10' : 'opacity-40'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-colors ${step === s ? 'bg-[#0071e3] text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {i + 1}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${step === s ? 'text-[#0071e3]' : 'hidden sm:block text-slate-500'}`}>
                      {s === 'cover_data' ? 'Configuração' : s === 'structure' ? 'Estrutura' : 'Finalização'}
                    </span>
                  </div>
                  {i < 2 && <div className="w-2 sm:w-4 h-[1px] bg-slate-200/50" />}
                </React.Fragment>
              ))}
              
              {/* Integrated Modern Progress Indicator */}
              {totalSections > 0 && (
                <>
                  <div className="w-[1px] h-4 bg-slate-200 mx-1 sm:mx-2" />
                  <div className="flex items-center gap-2 sm:gap-3 pl-1 pr-2">
                    <div className="w-16 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                      <motion.div 
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0071e3] to-[#0077ed] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-[9px] font-black text-[#0071e3] tabular-nums">{Math.round(progressPercent)}%</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 px-1.5 py-0.5 rounded-md">
                    Etapa {step === 'cover_data' ? '01' : step === 'structure' ? '02' : step === 'final' ? '03' : '04'}
                  </span>
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    {step === 'cover_data' ? 'Setup' : step === 'structure' ? 'Conteúdo' : step === 'final' ? 'Exportação' : 'Pagamento'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#0071e3] tracking-tighter leading-none">
                  {step === 'cover_data' ? 'Configuração Inicial' : step === 'structure' ? 'Estrutura do Trabalho' : step === 'final' ? 'Finalização' : 'Pagamento e-mola'}
                </h2>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-1.5 max-w-[180px] sm:max-w-none leading-tight">
                  {step === 'cover_data' 
                    ? 'Defina os parâmetros fundamentais do seu trabalho acadêmico.' 
                    : step === 'structure' 
                      ? 'Revise e gere o conteúdo de cada seção acadêmica.' 
                      : step === 'final'
                        ? 'Seu trabalho está pronto para exportação.'
                        : 'Realize o pagamento para baixar o seu trabalho.'}
                </p>
              </div>

              {step === 'structure' && (
                <Button 
                  onClick={generatedCount < sections.length ? handleGenerateAll : handleDownloadPdf}
                  isLoading={isLoading || isGeneratingPdf}
                  className="h-9 sm:h-10 px-3 sm:px-6 bg-[#0071e3] text-white hover:bg-[#0066cc] text-[9px] sm:text-[10px] font-bold rounded-xl transition-all duration-300 shadow-[0_4px_12px_rgba(0,113,227,0.15)] flex items-center shrink-0"
                >
                  {generatedCount < sections.length ? (
                    <>
                      <RefreshCcw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span className="whitespace-nowrap">Gerar trabalho</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
                      <span className="whitespace-nowrap">Baixar trabalho</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configuration & Steps */}
        <div className="lg:col-span-5 space-y-6">
          {/* Progress Card (Mobile Only) - Hidden as it's now in the floating bar */}
          <div className="lg:hidden">
            {/* Removed to avoid redundancy with the new floating progress bar */}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-medium">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
            {step === 'cover_data' && (
              <motion.div
                key="cover_data_step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-[32px] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.01)] border border-slate-200/40 space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Nível de Ensino</label>
                      <div className="flex p-1.5 bg-slate-50/50 rounded-2xl gap-1 border border-slate-100/50">
                    <button
                      onClick={() => setCoverData(prev => ({ ...prev, institutionType: 'university' }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        coverData.institutionType === 'university'
                          ? 'bg-white text-[#0077ed] shadow-sm'
                          : 'text-slate-400 hover:text-[#0071e3]'
                      }`}
                    >
                      Faculdade / Instituto
                    </button>
                    <button
                      onClick={() => setCoverData(prev => ({ ...prev, institutionType: 'secondary' }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                        coverData.institutionType === 'secondary'
                          ? 'bg-white text-[#0077ed] shadow-sm'
                          : 'text-slate-400 hover:text-[#0071e3]'
                      }`}
                    >
                      Escola Secundária
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1 flex items-center gap-2">
                    Logotipo da Instituição
                    <span className="text-[9px] font-medium text-[#94a3b8] lowercase">(Opcional)</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-[#f1f5f9] border-2 border-dashed border-[#cbd5e0] flex items-center justify-center overflow-hidden relative group">
                      {coverData.logo ? (
                        <>
                          <img src={coverData.logo} alt="Logo" className="w-full h-full object-contain" />
                          <button 
                            onClick={() => setCoverData(prev => ({ ...prev, logo: undefined }))}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <X className="w-5 h-5 text-white" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="w-6 h-6 text-[#cbd5e0]" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-[9px] text-[#86868b]">
                        Upload do logo (PNG/JPG). <span className="text-[#94a3b8]">Se não for carregado, a capa será gerada apenas com texto.</span>
                      </p>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCoverData(prev => ({ ...prev, logo: reader.result as string }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label 
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 border border-slate-200/40 rounded-xl text-[10px] font-bold text-black cursor-pointer hover:bg-white transition-all shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Selecionar Imagem
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Instituição</label>
                  <input 
                    type="text" 
                    placeholder="Ex: UNIVERSIDADE CATÓLICA DE MOÇAMBIQUE"
                    value={coverData.institution}
                    onChange={(e) => setCoverData(prev => ({ ...prev, institution: e.target.value }))}
                    className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coverData.institutionType === 'university' ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Faculdade/Centro
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: Centro de Ensino à Distância – CED"
                          value={coverData.faculty}
                          onChange={(e) => setCoverData(prev => ({ ...prev, faculty: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Curso
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: Direito"
                          value={coverData.course}
                          onChange={(e) => setCoverData(prev => ({ ...prev, course: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Ano de Frequência
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: 1º Ano"
                          value={coverData.academicYear}
                          onChange={(e) => setCoverData(prev => ({ ...prev, academicYear: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Cadeira
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: Direito Civil"
                          value={coverData.subject}
                          onChange={(e) => setCoverData(prev => ({ ...prev, subject: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Classe
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: 12ª Classe"
                          value={coverData.studentClass}
                          onChange={(e) => setCoverData(prev => ({ ...prev, studentClass: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Turma
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: B"
                          value={coverData.studentSection}
                          onChange={(e) => setCoverData(prev => ({ ...prev, studentSection: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                          Disciplina
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: Português"
                          value={coverData.subject}
                          onChange={(e) => setCoverData(prev => ({ ...prev, subject: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Tema Principal</label>
                  <input 
                    type="text" 
                    placeholder="Sobre o que é o trabalho?"
                    value={coverData.topic}
                    onChange={(e) => setCoverData(prev => ({ ...prev, topic: e.target.value }))}
                    className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Subtemas (Opcional)</label>
                  <div className="space-y-2">
                    {coverData.subTopics.map((sub, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="flex-1 relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b] font-medium">-</span>
                          <input 
                            type="text" 
                            placeholder="Descreva o subtema..."
                            value={sub}
                            onChange={(e) => {
                              const newSubs = [...coverData.subTopics];
                              newSubs[idx] = e.target.value;
                              setCoverData(prev => ({ ...prev, subTopics: newSubs }));
                            }}
                            className="w-full bg-white rounded-xl pl-8 pr-5 py-3 border border-slate-200 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                          />
                        </div>
                        <button 
                          onClick={() => setCoverData(prev => ({ ...prev, subTopics: prev.subTopics.filter((_, i) => i !== idx) }))}
                          className="w-11 h-11 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                          title="Remover subtema"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => setCoverData(prev => ({ ...prev, subTopics: [...prev.subTopics, ''] }))}
                      className="flex items-center gap-2 text-[9px] font-bold text-slate-400 hover:text-[#0077ed] transition-colors px-2 py-1"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar Subtema
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Estudante(s)</label>
                      <div className="flex bg-slate-50/50 p-1 rounded-xl border border-slate-100/50">
                        <button 
                          onClick={() => setCoverData(prev => ({ ...prev, studentType: 'individual' }))}
                          className={`text-[9px] font-bold px-4 py-1.5 rounded-lg transition-all ${coverData.studentType === 'individual' ? 'bg-white text-[#0077ed] shadow-sm' : 'text-slate-400 hover:text-[#0071e3]'}`}
                        >
                          Individual
                        </button>
                        <button 
                          onClick={() => setCoverData(prev => ({ ...prev, studentType: 'group' }))}
                          className={`text-[9px] font-bold px-4 py-1.5 rounded-lg transition-all ${coverData.studentType === 'group' ? 'bg-white text-[#0077ed] shadow-sm' : 'text-slate-400 hover:text-[#0071e3]'}`}
                        >
                          Grupo
                        </button>
                      </div>
                    </div>

                    {coverData.studentType === 'individual' ? (
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          placeholder="Nome do estudante"
                          value={coverData.studentName}
                          onChange={(e) => setCoverData(prev => ({ ...prev, studentName: e.target.value }))}
                          className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                        />
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">
                            {coverData.institutionType === 'university' ? 'Código do Estudante' : 'Nº do Aluno'}
                          </label>
                          <input 
                            type="text" 
                            placeholder={coverData.institutionType === 'university' ? "Ex: 708212345" : "Ex: 15 (Opcional)"}
                            value={coverData.studentNumber}
                            onChange={(e) => setCoverData(prev => ({ ...prev, studentNumber: e.target.value }))}
                            className="w-full bg-white rounded-xl px-4 py-2.5 border border-slate-200 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Adicionar nome ao grupo"
                            value={groupMemberInput}
                            onChange={(e) => setGroupMemberInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && groupMemberInput.trim()) {
                                e.preventDefault();
                                setCoverData(prev => ({ ...prev, studentList: [...prev.studentList, groupMemberInput.trim()] }));
                                setGroupMemberInput('');
                              }
                            }}
                            className="flex-1 bg-white rounded-xl px-5 py-3 border border-slate-200 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                          />
                          <button 
                            onClick={() => {
                              if (groupMemberInput.trim()) {
                                setCoverData(prev => ({ ...prev, studentList: [...prev.studentList, groupMemberInput.trim()] }));
                                setGroupMemberInput('');
                              }
                            }}
                            className="w-11 h-11 bg-[#0071e3]/90 text-white rounded-xl flex items-center justify-center hover:bg-[#0071e3] transition-all duration-300 shadow-[0_4px_12px_rgba(0,113,227,0.15)] active:scale-95"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        
                        {coverData.studentList.length > 0 && (
                          <div className="flex flex-wrap gap-2 p-1">
                            {coverData.studentList.map((name, idx) => (
                              <div key={idx} className="bg-[#f5faff] text-[#0077ed] text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2 border border-[#0077ed]/10">
                                {name}
                                <button 
                                  onClick={() => setCoverData(prev => ({ ...prev, studentList: prev.studentList.filter((_, i) => i !== idx) }))}
                                  className="hover:bg-[#0077ed]/10 rounded-full p-0.5 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Docente(s)</label>
                    <input 
                      type="text" 
                      placeholder="Um ou mais nomes"
                      value={coverData.professorName}
                      onChange={(e) => setCoverData(prev => ({ ...prev, professorName: e.target.value }))}
                      className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Local (Cidade)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Nampula"
                        value={coverData.location}
                        onChange={(e) => setCoverData(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full bg-white rounded-xl px-5 py-3 border border-slate-300 focus:ring-2 focus:ring-[#0077ed]/20 text-slate-500 text-xs italic placeholder:text-slate-400 transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Slider for Development Pages */}
                <div className="pt-2 pb-1 space-y-4">
                  <div className="flex justify-center items-center px-1">
                    <span className="text-base font-bold text-[#0071e3] tracking-tight">Total: {coverData.devPages} Páginas</span>
                  </div>

                  <div className="relative px-1 pt-1">
                    <input 
                      type="range" 
                      min="1" 
                      max="25" 
                      step="1"
                      value={coverData.devPages}
                      onChange={(e) => setCoverData(prev => ({ ...prev, devPages: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-slate-50 rounded-full appearance-none cursor-pointer accent-[#0071e3] transition-all"
                      style={{
                        background: `linear-gradient(to right, #0071e3 0%, #0071e3 ${((coverData.devPages - 1) / 24) * 100}%, #f8fafc ${((coverData.devPages - 1) / 24) * 100}%, #f8fafc 100%)`
                      }}
                    />
                    <div className="flex justify-between mt-2 px-0.5">
                      <span className="text-[7px] font-bold text-slate-300 uppercase tracking-[0.2em]">1 pág</span>
                      <span className="text-[7px] font-bold text-slate-300 uppercase tracking-[0.2em] text-right">25 págs</span>
                    </div>
                  </div>


                </div>

                {/* Folha de Rosto Toggle */}
                <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/50 flex items-center justify-center shadow-[0_2px_10px_rgb(0,0,0,0.01)]">
                      <FileText className="w-4 h-4 text-[#0077ed]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[#0071e3]">Folha de Rosto</p>
                      <p className="text-[9px] text-[#64748b]">Incluir página de título</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCoverData(prev => ({ ...prev, showFolhaDeRosto: !prev.showFolhaDeRosto }))}
                    className={`w-10 h-5 rounded-full transition-all duration-300 relative ${coverData.showFolhaDeRosto ? 'bg-[#0071e3]/90' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${coverData.showFolhaDeRosto ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {/* Avançado Toggle */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between bg-white/50 p-4 rounded-[20px] border border-slate-200/40 shadow-[0_4px_20px_rgb(0,0,0,0.01)] hover:bg-white transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                        <Settings2 className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-[13px] font-bold text-[#0071e3]">Configurações Avançadas</p>
                        <p className="text-[9px] text-[#64748b]">Marcadores, tabelas, gráficos e anexos</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${showAdvanced ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-6 pt-2"
                    >
                      {/* Permissão para Gráficos e Tabelas */}
                      <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_12px_rgb(0,0,0,0.01)] border border-slate-200/40 flex items-center justify-between">
                        <div className="flex-1 pr-4">
                          <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Geração Automática de Dados</label>
                          <p className="text-[8px] text-[#64748b]">Permitir que a IA gere tabelas e gráficos automaticamente no desenvolvimento.</p>
                        </div>
                        <button
                          onClick={() => setCoverData(prev => ({ ...prev, allowChartsAndTables: !prev.allowChartsAndTables }))}
                          className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${coverData.allowChartsAndTables ? 'bg-[#0077ed]' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${coverData.allowChartsAndTables ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Estilo de Marcadores (Moved here) */}
                      <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_12px_rgb(0,0,0,0.01)] border border-slate-200/40 space-y-3">
                        <label className="text-[10px] font-bold text-black uppercase tracking-normal ml-1">Estilo de Marcadores (Bullets)</label>
                        <div className="flex p-1 bg-slate-50/50 rounded-xl gap-1 border border-slate-100/50">
                          <button
                            onClick={() => setCoverData(prev => ({ ...prev, bulletStyle: 'bolas' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                              coverData.bulletStyle === 'bolas'
                                ? 'bg-white text-[#0077ed] shadow-sm'
                                : 'text-slate-400 hover:text-[#0071e3]'
                            }`}
                          >
                            <span className="text-lg leading-none">•</span> Bolas
                          </button>
                          <button
                            onClick={() => setCoverData(prev => ({ ...prev, bulletStyle: 'setas' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                              coverData.bulletStyle === 'setas'
                                ? 'bg-white text-[#0077ed] shadow-sm'
                                : 'text-slate-400 hover:text-[#0071e3]'
                            }`}
                          >
                            <span className="text-lg leading-none">→</span> Setas
                          </button>
                          <button
                            onClick={() => setCoverData(prev => ({ ...prev, bulletStyle: 'selecao' }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                              coverData.bulletStyle === 'selecao'
                                ? 'bg-white text-[#0077ed] shadow-sm'
                                : 'text-slate-400 hover:text-[#0071e3]'
                            }`}
                          >
                            <span className="text-lg leading-none">✓</span> Seleção
                          </button>
                        </div>
                        <p className="text-[9px] text-[#94a3b8] ml-1 italic">O estilo escolhido será mantido em todo o trabalho para garantir profissionalismo.</p>
                      </div>

                      {/* Elementos Adicionais Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[10px] font-black text-[#0071e3]/20 uppercase tracking-[0.3em]">Elementos Adicionais</span>
                        </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setCoverData(prev => ({
                        ...prev,
                        additionalElements: {
                          ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }),
                          tables: [...(prev.additionalElements?.tables || []), { id: Math.random().toString(36).substr(2, 9), title: 'Nova Tabela', content: '| Coluna 1 | Coluna 2 |\n|---|---|\n| Dado 1 | Dado 2 |' }]
                        }
                      }))}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/50 rounded-2xl border border-slate-200/40 hover:border-[#0071e3]/30 transition-all group shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#0077ed]/5 flex items-center justify-center group-hover:bg-[#0077ed]/10 transition-colors">
                        <TableIcon className="w-5 h-5 text-[#0077ed]" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-[#0071e3]">Tabela</span>
                    </button>

                    <button 
                      onClick={() => setCoverData(prev => ({
                        ...prev,
                        additionalElements: {
                          ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }),
                          charts: [...(prev.additionalElements?.charts || []), { id: Math.random().toString(36).substr(2, 9), title: 'Novo Gráfico', type: 'bar', data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] }]
                        }
                      }))}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/50 rounded-2xl border border-slate-200/40 hover:border-[#0071e3]/30 transition-all group shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#0077ed]/5 flex items-center justify-center group-hover:bg-[#0077ed]/10 transition-colors">
                        <BarChart2 className="w-5 h-5 text-[#0077ed]" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-[#0071e3]">Gráfico</span>
                    </button>

                    <button 
                      onClick={() => setCoverData(prev => ({
                        ...prev,
                        additionalElements: {
                          ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }),
                          attachments: [...(prev.additionalElements?.attachments || []), { id: Math.random().toString(36).substr(2, 9), title: 'Novo Anexo', text: '' }]
                        }
                      }))}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/50 rounded-2xl border border-slate-200/40 hover:border-[#0071e3]/30 transition-all group shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#0077ed]/5 flex items-center justify-center group-hover:bg-[#0077ed]/10 transition-colors">
                        <ImageIcon className="w-5 h-5 text-[#0077ed]" />
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 group-hover:text-[#0071e3]">Anexo</span>
                    </button>
                  </div>

                  {/* List of added elements */}
                  <div className="space-y-3">
                    {/* Tables */}
                    {(coverData.additionalElements?.tables || []).map((table, idx) => (
                      <motion.div 
                        key={table.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/50 p-4 rounded-2xl border border-slate-200/40 space-y-3 shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TableIcon className="w-3.5 h-3.5 text-[#0077ed]" />
                            <input 
                              type="text"
                              value={table.title}
                              onChange={(e) => {
                                const newTables = [...(coverData.additionalElements?.tables || [])];
                                if (newTables[idx]) {
                                  newTables[idx].title = e.target.value;
                                  setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), tables: newTables } }));
                                }
                              }}
                              className="text-[10px] italic text-slate-500 bg-transparent border-none focus:ring-0 p-0 w-40"
                              placeholder="Título da Tabela"
                            />
                          </div>
                          <button 
                            onClick={() => setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), tables: (prev.additionalElements?.tables || []).filter(t => t.id !== table.id) } }))}
                            className="text-red-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea 
                          value={table.content}
                          onChange={(e) => {
                            const newTables = [...(coverData.additionalElements?.tables || [])];
                            if (newTables[idx]) {
                              newTables[idx].content = e.target.value;
                              setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), tables: newTables } }));
                            }
                          }}
                          className="w-full h-24 text-[10px] text-slate-500 italic font-mono bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-[#0077ed]/20 outline-none transition-all resize-none shadow-sm"
                          placeholder="| Coluna 1 | Coluna 2 |..."
                        />
                      </motion.div>
                    ))}

                    {/* Charts */}
                    {(coverData.additionalElements?.charts || []).map((chart, idx) => (
                      <motion.div 
                        key={chart.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/50 p-4 rounded-2xl border border-slate-200/40 space-y-3 shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart2 className="w-3.5 h-3.5 text-[#0077ed]" />
                            <input 
                              type="text"
                              value={chart.title}
                              onChange={(e) => {
                                const newCharts = [...(coverData.additionalElements?.charts || [])];
                                if (newCharts[idx]) {
                                  newCharts[idx].title = e.target.value;
                                  setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: newCharts } }));
                                }
                              }}
                              className="text-[10px] italic text-slate-500 bg-transparent border-none focus:ring-0 p-0 w-40"
                              placeholder="Título do Gráfico"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <select 
                              value={chart.type}
                              onChange={(e) => {
                                const newCharts = [...(coverData.additionalElements?.charts || [])];
                                if (newCharts[idx]) {
                                  newCharts[idx].type = e.target.value as 'bar' | 'pie';
                                  setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: newCharts } }));
                                }
                              }}
                              className="text-[9px] italic text-slate-500 bg-[#f1f5f9] border-none rounded-lg px-2 py-1 outline-none"
                            >
                              <option value="bar">Barras</option>
                              <option value="pie">Pizza</option>
                            </select>
                            <button 
                              onClick={() => setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: (prev.additionalElements?.charts || []).filter(c => c.id !== chart.id) } }))}
                              className="text-red-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {(chart.data || []).map((item, dIdx) => (
                            <div key={dIdx} className="flex gap-2">
                              <input 
                                type="text"
                                value={item.label}
                                onChange={(e) => {
                                  const newCharts = [...(coverData.additionalElements?.charts || [])];
                                  if (newCharts[idx] && newCharts[idx].data[dIdx]) {
                                    newCharts[idx].data[dIdx].label = e.target.value;
                                    setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: newCharts } }));
                                  }
                                }}
                                className="flex-1 text-[9px] text-slate-500 italic bg-[#f1f5f9] rounded-lg px-3 py-1.5 border-none"
                                placeholder="Rótulo"
                              />
                              <input 
                                type="number"
                                value={item.value}
                                onChange={(e) => {
                                  const newCharts = [...(coverData.additionalElements?.charts || [])];
                                  if (newCharts[idx] && newCharts[idx].data[dIdx]) {
                                    newCharts[idx].data[dIdx].value = parseFloat(e.target.value) || 0;
                                    setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: newCharts } }));
                                  }
                                }}
                                className="w-16 text-[9px] text-slate-500 italic bg-[#f1f5f9] rounded-lg px-3 py-1.5 border-none"
                                placeholder="Valor"
                              />
                              <button 
                                onClick={() => {
                                  const newCharts = [...(coverData.additionalElements?.charts || [])];
                                  if (newCharts[idx]) {
                                    newCharts[idx].data = newCharts[idx].data.filter((_, i) => i !== dIdx);
                                    setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: newCharts } }));
                                  }
                                }}
                                className="text-red-400 p-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newCharts = [...(coverData.additionalElements?.charts || [])];
                              if (newCharts[idx]) {
                                newCharts[idx].data.push({ label: '', value: 0 });
                                setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), charts: newCharts } }));
                              }
                            }}
                            className="text-[8px] font-bold text-slate-400 hover:text-[#0071e3] transition-colors px-1"
                          >
                            + Adicionar Dado
                          </button>
                        </div>
                      </motion.div>
                    ))}

                    {/* Attachments */}
                    {(coverData.additionalElements?.attachments || []).map((att, idx) => (
                      <motion.div 
                        key={att.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/50 p-4 rounded-2xl border border-slate-200/40 space-y-3 shadow-[0_2px_10px_rgb(0,0,0,0.01)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5 text-[#0077ed]" />
                            <input 
                              type="text"
                              value={att.title}
                              onChange={(e) => {
                                const newAtts = [...(coverData.additionalElements?.attachments || [])];
                                if (newAtts[idx]) {
                                  newAtts[idx].title = e.target.value;
                                  setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), attachments: newAtts } }));
                                }
                              }}
                              className="text-[10px] italic text-slate-500 bg-transparent border-none focus:ring-0 p-0 w-40"
                              placeholder="Título do Anexo"
                            />
                          </div>
                          <button 
                            onClick={() => setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), attachments: (prev.additionalElements?.attachments || []).filter(a => a.id !== att.id) } }))}
                            className="text-red-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-20 h-20 bg-[#f1f5f9] rounded-xl border-2 border-dashed border-[#cbd5e0] flex items-center justify-center overflow-hidden relative group shrink-0">
                            {att.image ? (
                              <>
                                <img src={att.image} alt="Attachment" className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => {
                                    const newAtts = [...(coverData.additionalElements?.attachments || [])];
                                    if (newAtts[idx]) {
                                      newAtts[idx].image = undefined;
                                      setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), attachments: newAtts } }));
                                    }
                                  }}
                                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                >
                                  <X className="w-4 h-4 text-white" />
                                </button>
                              </>
                            ) : (
                              <label className="cursor-pointer flex flex-col items-center">
                                <Upload className="w-4 h-4 text-[#cbd5e0]" />
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        const newAtts = [...(coverData.additionalElements?.attachments || [])];
                                        if (newAtts[idx]) {
                                          newAtts[idx].image = reader.result as string;
                                          setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), attachments: newAtts } }));
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          <textarea 
                            value={att.text}
                            onChange={(e) => {
                              const newAtts = [...(coverData.additionalElements?.attachments || [])];
                              if (newAtts[idx]) {
                                newAtts[idx].text = e.target.value;
                                setCoverData(prev => ({ ...prev, additionalElements: { ...(prev.additionalElements || { tables: [], charts: [], attachments: [] }), attachments: newAtts } }));
                              }
                            }}
                            className="flex-1 h-20 text-[9px] text-slate-500 italic bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-[#0077ed]/20 outline-none transition-all resize-none placeholder:text-slate-400 shadow-sm"
                            placeholder="Descrição ou texto do anexo..."
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-end gap-3 mt-6">
                  <Button 
                    onClick={handleSaveData}
                    variant="outline"
                    className="h-9 px-4 rounded-xl text-[9px] font-bold border-slate-200/40 text-slate-400 hover:bg-slate-50 hover:text-[#0071e3] transition-all duration-300"
                  >
                    {saveStatus === 'saved' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0077ed]" />
                        Salvo
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Salvar Dados
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={handleGenerateStructure} 
                    isLoading={isLoading}
                    className="h-9 px-8 rounded-xl text-[9px] font-bold bg-[#0071e3]/90 text-white hover:bg-[#0071e3] shadow-[0_4px_12px_rgba(0,113,227,0.15)] transition-all duration-300"
                  >
                    Prosseguir
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

            {step === 'structure' && (
              <motion.div
                key="structure_step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {(sections || []).map((section, index) => (
                      <div key={section.id} className="bg-white rounded-2xl p-3.5 flex items-center justify-between shadow-[0_2px_8px_rgb(0,0,0,0.01)] border border-slate-200/40 group">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-300">
                            {index + 1}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-[#0071e3] text-sm">{section.title}</span>
                          </div>
                          <button 
                            onClick={() => handleDeleteSection(section.id)}
                            className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Eliminar Seção"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        {section.content ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 text-[#22c55e] mr-2">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            
                            <Button 
                              variant="action" 
                              onClick={() => setPreviewSection(section)}
                              className="h-8 px-4 text-[9px] font-bold bg-slate-50 text-slate-500 hover:bg-white hover:text-[#0071e3] rounded-lg shadow-none border border-slate-100/50 transition-all duration-300"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Preview
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="action" 
                            onClick={() => handleGenerateSection(section.id)}
                            isLoading={section.isGenerating}
                            className="h-8 px-5 text-[9px] font-bold bg-[#0071e3]/90 text-white hover:bg-[#0071e3] rounded-lg shadow-[0_4px_12px_rgba(0,113,227,0.15)] border-none transition-all duration-300"
                          >
                            Gerar
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                key="payment_step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto"
              >
                <div className="bg-white rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,113,227,0.1)] border border-slate-100 space-y-8 relative overflow-hidden">
                  {/* Decorative background element */}
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#0071e3]/5 rounded-full blur-3xl" />
                  
                  <div className="text-center space-y-4 relative z-10">
                    <div className="w-16 h-16 bg-[#0071e3]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 shadow-sm">
                      <CreditCard className="w-8 h-8 text-[#0071e3]" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pagamento via e-mola</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Para baixar o seu trabalho acadêmico completo, realize a transferência para o número abaixo.
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 relative z-10">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número e-mola</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-[#0071e3] tracking-wider">878404244</span>
                        <button 
                          onClick={handleCopy}
                          className={`p-2 rounded-lg border transition-all shadow-sm flex items-center gap-2 ${
                            copied 
                              ? 'bg-green-50 border-green-200 text-green-600' 
                              : 'bg-white border-slate-200 text-slate-400 hover:text-[#0071e3] hover:border-[#0071e3]'
                          }`}
                          title="Copiar número"
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied && <span className="text-[10px] font-bold uppercase tracking-tight">Copiado</span>}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div className="flex items-start gap-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                      <div className="w-5 h-5 rounded-full bg-[#0071e3] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium leading-normal">
                        Após a confirmação da transferência, o seu trabalho estará disponível <span className="text-[#0071e3] font-bold">automaticamente</span> para download.
                      </p>
                    </div>

                    <Button 
                      onClick={generateAndDownloadPdf}
                      isLoading={isGeneratingPdf}
                      className="w-full h-14 bg-[#0071e3] text-white hover:bg-[#0066cc] text-sm font-bold rounded-2xl shadow-[0_10px_25px_rgba(0,113,227,0.2)] transition-all duration-300 group"
                    >
                      Já realizei o pagamento
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>

                    <button 
                      onClick={() => setStep('structure')}
                      className="w-full text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest py-2"
                    >
                      Voltar para a estrutura
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Document Preview (Desktop Only) */}
        <div className="lg:col-span-7 hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {/* Progress Card (Desktop) */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 space-y-3"
            >
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Status da Geração</p>
                  <h3 className="text-lg font-bold text-[#0071e3]">{generatedCount} de {totalSections} Seções Completas</h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#0077ed]">{Math.round(progressPercent)}%</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[#0077ed] rounded-full shadow-[0_0_10px_rgba(0,119,237,0.3)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </motion.div>

            {/* Document Preview Area */}
            <div className="bg-slate-200/50 rounded-3xl p-8 border border-slate-200/60 min-h-[800px] shadow-inner overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-20"></div>
              
              <div className="relative bg-white w-full aspect-[1/1.414] shadow-2xl rounded-sm mx-auto overflow-hidden flex flex-col origin-top transition-transform duration-500 hover:scale-[1.01]">
                {/* Paper Texture Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"></div>
                
                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-12 academic-mozambique no-scrollbar">
                  {sections.length > 0 ? (
                    <div className="space-y-8">
                      {sections.map((section, idx) => (
                        <div key={section.id} className="space-y-4">
                          {section.type !== 'capa' && section.type !== 'rosto' && (
                            <h2 className="text-sm font-bold uppercase border-b border-slate-100 pb-2 text-slate-400">
                              {section.title}
                            </h2>
                          )}
                          <div className="text-[10px] text-slate-700 leading-relaxed">
                            {section.content ? (
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => {
                                    const content = children?.toString() || "";
                                    if (content.includes('[GRAFICO:')) {
                                      return <ChartRenderer tag={content} />;
                                    }
                                    if (content.includes('[IMAGEM_ANEXO:')) {
                                      return <AttachmentImageRenderer tag={content} coverData={coverData} />;
                                    }
                                    return <p className={`mb-4 text-justify ${section.type === 'indice' ? 'font-normal' : ''}`}>{children}</p>;
                                  },
                                  h1: ({ children }) => <h1 className={`text-base mb-4 ${section.type === 'indice' ? 'font-normal' : 'font-bold uppercase'}`}>{children}</h1>,
                                  h2: ({ children }) => <h2 className={`text-sm mb-3 ${section.type === 'indice' ? 'font-normal' : 'font-bold uppercase'}`}>{children}</h2>,
                                  h3: ({ children }) => <h3 className={`text-xs mb-2 ${section.type === 'indice' ? 'font-normal' : 'font-bold'}`}>{children}</h3>,
                                  ul: ({ children }) => <ul className="list-disc pl-4 mb-4 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-4 space-y-1">{children}</ol>,
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-4">
                                      <table className="min-w-full border-collapse border border-slate-300 text-[8px]">
                                        {children}
                                      </table>
                                    </div>
                                  ),
                                  td: ({ children }) => <td className="border border-slate-300 p-1">{children}</td>,
                                  th: ({ children }) => <th className="border border-slate-300 p-1 bg-slate-50 font-bold">{children}</th>,
                                }}
                              >
                                {section.content}
                              </ReactMarkdown>
                            ) : (
                              <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-xl">
                                <p className="text-slate-300 italic text-[9px]">Conteúdo ainda não gerado...</p>
                              </div>
                            )}
                          </div>
                          {idx < sections.length - 1 && <div className="h-px bg-slate-50 my-8" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                      <FileText className="w-16 h-16 text-slate-300" />
                      <p className="font-sans text-lg italic text-slate-400">Aguardando configuração...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Floating Action Hint */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0071e3]/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2">
                <Eye className="w-3 h-3" /> Visualização em Tempo Real
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Preview Modal for Mobile */}
      <AnimatePresence>
        {previewSection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 lg:hidden"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#0071e3]">{previewSection.title}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pré-visualização da Seção</p>
                </div>
                <button 
                  onClick={() => setPreviewSection(null)}
                  className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-[#0071e3] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 academic-mozambique no-scrollbar">
                <div className="bg-white p-8 shadow-sm border border-slate-100 rounded-sm">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => {
                        const content = children?.toString() || "";
                        if (content.includes('[GRAFICO:')) {
                          return <ChartRenderer tag={content} />;
                        }
                        if (content.includes('[IMAGEM_ANEXO:')) {
                          return <AttachmentImageRenderer tag={content} coverData={coverData} />;
                        }
                        return <p className={`mb-4 text-justify ${previewSection.type === 'indice' ? 'font-normal' : ''}`}>{children}</p>;
                      },
                      h1: ({ children }) => <h1 className={`text-base mb-4 ${previewSection.type === 'indice' ? 'font-normal' : 'font-bold uppercase'}`}>{children}</h1>,
                      h2: ({ children }) => <h2 className={`text-sm mb-3 ${previewSection.type === 'indice' ? 'font-normal' : 'font-bold uppercase'}`}>{children}</h2>,
                      h3: ({ children }) => <h3 className={`text-xs mb-2 ${previewSection.type === 'indice' ? 'font-normal' : 'font-bold'}`}>{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-4 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-4 space-y-1">{children}</ol>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="min-w-full border-collapse border border-slate-300 text-[8px]">
                            {children}
                          </table>
                        </div>
                      ),
                      td: ({ children }) => <td className="border border-slate-300 p-1">{children}</td>,
                      th: ({ children }) => <th className="border border-slate-300 p-1 bg-slate-50 font-bold">{children}</th>,
                    }}
                  >
                    {previewSection.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 flex justify-end">
                <Button onClick={() => setPreviewSection(null)} variant="primary" className="px-8">
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="py-8 text-center text-slate-300 text-[10px] font-bold tracking-widest uppercase">
        mzdoc • Excelência Acadêmica
      </footer>

      {/* Hamburger Menu Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            
            {/* Drawer */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-[320px] bg-white z-[101] shadow-2xl flex flex-col"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                    <BookOpen className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-black">Menu Principal</h3>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">mzdoc</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* User Profile Section in Menu */}
              <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
                    <img 
                      src="https://picsum.photos/seed/academic/200" 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-black truncate">
                      {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Onório Batalhão'}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">Plano Gratuito</p>
                    <button className="mt-1 text-[9px] font-bold text-[#0071e3] uppercase tracking-wider hover:underline">
                      Upgrade para Pro
                    </button>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-4 mb-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Trabalhos</p>
                  <button 
                    onClick={() => {
                      setShowHistory(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#0071e3] rounded-xl transition-all group"
                  >
                    <History className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3]" />
                    <span className="text-xs font-bold">Meus Trabalhos</span>
                    <span className="ml-auto bg-slate-100 text-slate-500 text-[8px] px-1.5 py-0.5 rounded-md">{savedWorks.length}</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#0071e3] rounded-xl transition-all group">
                    <BookMarked className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3]" />
                    <span className="text-xs font-bold">Normas Académicas</span>
                  </button>
                </div>

                <div className="px-4 mb-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Conta</p>
                  <button className="w-full flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#0071e3] rounded-xl transition-all group">
                    <UserIcon className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3]" />
                    <span className="text-xs font-bold">Perfil e Definições</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowSubscription(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#0071e3] rounded-xl transition-all group"
                  >
                    <CreditCard className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3]" />
                    <span className="text-xs font-bold">Subscrição</span>
                  </button>

                  <button 
                    onClick={() => {
                      const appUrl = window.location.origin;
                      navigator.clipboard.writeText(appUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#0071e3] rounded-xl transition-all group"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3]" />
                    )}
                    <span className="text-xs font-bold">{copied ? 'Link Copiado!' : 'Copiar Link da App'}</span>
                  </button>
                </div>

                <div className="px-4">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] px-2 mb-2">Suporte</p>
                  <button className="w-full flex items-center gap-3 px-3 py-3 text-slate-600 hover:bg-slate-50 hover:text-[#0071e3] rounded-xl transition-all group">
                    <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-[#0071e3]" />
                    <span className="text-xs font-bold">Tutorial de Uso</span>
                  </button>
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-100">
                <button 
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Terminar Sessão
                </button>
                <p className="mt-4 text-[8px] text-center text-slate-400 font-medium uppercase tracking-widest">
                  v1.2.4 • mzdoc
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-black">Meus Trabalhos</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Histórico de Gerações</p>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-[#0071e3] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
                {savedWorks.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
                    <History className="w-12 h-12 mb-2" />
                    <p className="text-sm italic">Nenhum trabalho salvo ainda.</p>
                  </div>
                ) : (
                  savedWorks.map((work) => (
                    <div 
                      key={work.id}
                      className="p-4 rounded-2xl border border-slate-100 hover:border-[#0071e3]/30 hover:bg-slate-50/50 transition-all group cursor-pointer"
                      onClick={() => {
                        setCoverData(work.coverData);
                        setSections(work.sections);
                        setStep('structure');
                        setShowHistory(false);
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-sm text-black group-hover:text-[#0071e3] transition-colors truncate pr-4">
                          {work.topic}
                        </h4>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {work.createdAt?.toDate ? new Date(work.createdAt.toDate()).toLocaleDateString() : 'Recente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {work.coverData.subject}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {work.sections.length} Seções
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-6 bg-slate-50 flex justify-end">
                <Button onClick={() => setShowHistory(false)} variant="primary" className="px-8">
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscription Modal */}
      <AnimatePresence>
        {showSubscription && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-bold text-black">Planos mzdoc</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Escolha o melhor para o seu sucesso</p>
                </div>
                <button 
                  onClick={() => setShowSubscription(false)}
                  className="p-2 bg-white rounded-full text-slate-400 hover:text-[#0071e3] shadow-sm transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Free Plan */}
                  <div className="p-6 rounded-[24px] border border-slate-100 flex flex-col">
                    <div className="mb-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Básico</span>
                      <h4 className="text-xl font-bold text-black">Grátis</h4>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 1 Trabalho por dia
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Estrutura básica
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-400">
                        <X className="w-4 h-4" /> Sem exportação PDF
                      </li>
                    </ul>
                    <Button variant="secondary" className="w-full" disabled>Plano Atual</Button>
                  </div>

                  {/* Pro Plan */}
                  <div className="p-6 rounded-[24px] border-2 border-[#0071e3] bg-[#0071e3]/5 flex flex-col relative overflow-hidden">
                    <div className="absolute top-4 right-4 bg-[#0071e3] text-white text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Popular</div>
                    <div className="mb-4">
                      <span className="text-[10px] font-bold text-[#0071e3] uppercase tracking-widest">Estudante</span>
                      <div className="flex items-baseline gap-1">
                        <h4 className="text-2xl font-bold text-black">299 MT</h4>
                        <span className="text-xs text-slate-400">/mês</span>
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-[#0071e3]" /> Trabalhos ilimitados
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-[#0071e3]" /> Exportação PDF Premium
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-[#0071e3]" /> Normas APA/ABNT
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-[#0071e3]" /> Suporte prioritário
                      </li>
                    </ul>
                    <Button variant="primary" className="w-full shadow-lg shadow-[#0071e3]/20">Assinar Agora</Button>
                  </div>

                  {/* Enterprise Plan */}
                  <div className="p-6 rounded-[24px] border border-slate-100 flex flex-col">
                    <div className="mb-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Académico</span>
                      <div className="flex items-baseline gap-1">
                        <h4 className="text-2xl font-bold text-black">999 MT</h4>
                        <span className="text-xs text-slate-400">/ano</span>
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tudo do plano Estudante
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Acesso antecipado
                      </li>
                      <li className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Sem marcas de água
                      </li>
                    </ul>
                    <Button variant="secondary" className="w-full">Escolher Plano</Button>
                  </div>
                </div>

                <div className="mt-12 p-6 bg-slate-50 rounded-[24px] text-center">
                  <p className="text-xs text-slate-500 mb-4">Aceitamos pagamentos via M-Pesa, E-Mola e Cartão de Crédito.</p>
                  <div className="flex items-center justify-center gap-6 opacity-50 grayscale">
                    <div className="h-6 w-12 bg-slate-300 rounded"></div>
                    <div className="h-6 w-12 bg-slate-300 rounded"></div>
                    <div className="h-6 w-12 bg-slate-300 rounded"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
