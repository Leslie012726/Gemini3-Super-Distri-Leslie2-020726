import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, ZAxis, ComposedChart
} from 'recharts';
import * as Lucide from 'lucide-react';

import { MedFlowRow, DataMetrics, SkinType, Lang, AgentPipeline, AgentStep, GlobalFilters } from './types';
import { SKINS, I18N, DEFAULT_SAMPLE_CSV, DEFAULT_AGENTS_YAML, DEFAULT_SKILL_MD, DEFAULT_FULL_DATASET, SUGGESTED_QUESTIONS } from './constants';
import { parseData } from './services/dataService';
import { callGeminiAgent } from './services/geminiService';
import NetworkGraph from './components/NetworkGraph';

// --- Utility Components ---
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-6 rounded-2xl shadow-lg border border-white/20 transition-all duration-300 ${className}`} style={{ backdropFilter: 'blur(10px)' }}>
    {children}
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = 
  ({ children, className = '', variant = 'primary', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center";
  const variants = {
    primary: "bg-white/20 hover:bg-white/30 text-current border border-white/30",
    secondary: "bg-black/20 hover:bg-black/30 text-current border border-white/10",
    danger: "bg-red-500/20 hover:bg-red-500/30 text-red-100 border border-red-500/30"
  };
  return <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

// --- Main App ---
export default function App() {
  // State: Settings
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [skin, setSkin] = useState<SkinType>('VanGogh');
  const [lang, setLang] = useState<Lang>('en');
  const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
  
  // State: Data
  const [inputText, setInputText] = useState(DEFAULT_FULL_DATASET);
  const [data, setData] = useState<MedFlowRow[]>([]);
  const [metrics, setMetrics] = useState<DataMetrics | null>(null);
  const [previewRows, setPreviewRows] = useState(20);
  
  // State: Filters
  const [filters, setFilters] = useState<GlobalFilters>({
    dateRange: ['', ''],
    topN: 10,
    searchSupplier: '',
    category: '',
    licenseNo: '',
    model: '',
    lotNo: '',
    serNo: '',
    customerID: '',
    timeZone: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // State: Network Selection
  const [networkNode, setNetworkNode] = useState<{ id: string, type: 'supplier' | 'category' | 'customer' } | null>(null);

  // State: Agents
  const [agentsYaml, setAgentsYaml] = useState(DEFAULT_AGENTS_YAML);
  const [skillMd, setSkillMd] = useState(DEFAULT_SKILL_MD);
  const [pipeline, setPipeline] = useState<AgentPipeline | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isParsing, setIsParsing] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived Values
  const t = I18N[lang];
  const currentSkin = SKINS[skin];
  const chartColors = [currentSkin.accent, '#4ADE80', '#F472B6', '#FACC15', '#60A5FA', '#A78BFA'];

  // Apply Theme & Skin
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  // Initial Parse
  useEffect(() => {
    handleParse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Yaml Parsing
  useEffect(() => {
    try {
      const lines = agentsYaml.split('\n');
      const steps: AgentStep[] = [];
      let currentStep: Partial<AgentStep> = {};
      
      let inAgents = false;
      lines.forEach(line => {
        if (line.includes('agents:')) { inAgents = true; return; }
        if (!inAgents) return;
        
        const trimmed = line.trim();
        if (trimmed.startsWith('- id:')) {
            if (currentStep.id) steps.push(currentStep as AgentStep);
            currentStep = { status: 'idle', output: '' };
            currentStep.id = trimmed.split('id:')[1].trim().replace(/"/g, '');
        } else if (trimmed.startsWith('name:')) currentStep.name = trimmed.split('name:')[1].trim().replace(/"/g, '');
        else if (trimmed.startsWith('provider:')) currentStep.provider = trimmed.split('provider:')[1].trim().replace(/"/g, '') as any;
        else if (trimmed.startsWith('model:')) currentStep.model = trimmed.split('model:')[1].trim().replace(/"/g, '');
        else if (trimmed.startsWith('system_prompt:')) currentStep.system_prompt = trimmed.split('system_prompt:')[1].trim().replace(/"/g, '');
        else if (trimmed.startsWith('user_prompt_template:')) currentStep.user_prompt_template = trimmed.split('user_prompt_template:')[1].trim().replace(/"/g, '');
        else if (trimmed.startsWith('max_tokens:')) currentStep.max_tokens = parseInt(trimmed.split('max_tokens:')[1].trim());
      });
      if (currentStep.id) steps.push(currentStep as AgentStep);

      setPipeline({ defaults: { temperature: 0.2, max_tokens: 2000 }, agents: steps });
    } catch (e) {
      console.error("YAML Parse Error", e);
    }
  }, [agentsYaml]);

  // Actions
  const handleParse = () => {
    setIsParsing(true);
    setTimeout(() => {
      try {
        const result = parseData(inputText);
        setData(result.data);
        setMetrics(result.metrics);
      } catch (e) {
        alert("Failed to parse Data");
      }
      setIsParsing(false);
    }, 500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        if (evt.target?.result) {
            setInputText(evt.target.result as string);
        }
    };
    reader.readAsText(file);
  };

  const handleLoadDefault = () => {
      setInputText(DEFAULT_FULL_DATASET);
  };

  const handleJackpot = () => {
    const keys = Object.keys(SKINS) as SkinType[];
    let count = 0;
    const interval = setInterval(() => {
      const randomSkin = keys[Math.floor(Math.random() * keys.length)];
      setSkin(randomSkin);
      count++;
      if (count > 8) clearInterval(interval);
    }, 100);
  };

  const runAgentStep = async (index: number) => {
    if (!pipeline || !metrics) return;
    
    const newAgents = [...pipeline.agents];
    newAgents[index].status = 'running';
    setPipeline({ ...pipeline, agents: newAgents });

    const dataSummary = JSON.stringify({
       totalUnits: metrics.totalUnits,
       uniqueSuppliers: metrics.uniqueSuppliers,
       topCategories: filteredData.slice(0, 5).map(r => r.Category),
       dateRange: metrics.dateRange
    });
    
    const previousOutput = index > 0 ? pipeline.agents[index-1].output : "None";
    
    let prompt = newAgents[index].user_prompt_template
        .replace('{{data_summary}}', dataSummary)
        .replace('{{previous_output}}', previousOutput);

    const response = await callGeminiAgent(
        apiKey,
        newAgents[index].model,
        `${newAgents[index].system_prompt}\n\n${skillMd}`,
        prompt,
        newAgents[index].max_tokens
    );

    newAgents[index].status = 'completed';
    newAgents[index].output = response;
    setPipeline({ ...pipeline, agents: newAgents });
  };

  const runPipeline = async () => {
    if (!pipeline) return;
    for (let i = 0; i < pipeline.agents.length; i++) {
        await runAgentStep(i);
    }
  };

  // Filter Data Logic
  const filteredData = useMemo(() => {
    let res = data;
    // Apply filters
    const match = (val: string, filter: string) => !filter || val.toLowerCase().includes(filter.toLowerCase());
    
    res = res.filter(r => 
        match(r.SupplierID, filters.searchSupplier) &&
        match(r.Category, filters.category) &&
        match(r.LicenseNo, filters.licenseNo) &&
        match(r.Model, filters.model) &&
        match(r.LotNO, filters.lotNo) &&
        match(r.SerNo, filters.serNo) &&
        match(r.CustomerID, filters.customerID)
    );
    
    return res;
  }, [data, filters]);

  // --- Chart Data Aggregation (Dashboard) ---
  const trendData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach(r => {
        const d = r.Deliverdate; 
        agg[d] = (agg[d] || 0) + r.Number;
    });
    return Object.entries(agg).map(([date, val]) => ({ date, val })).sort((a,b) => a.date.localeCompare(b.date));
  }, [filteredData]);

  const catData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach(r => {
        agg[r.Category] = (agg[r.Category] || 0) + r.Number;
    });
    return Object.entries(agg)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, filters.topN);
  }, [filteredData, filters.topN]);

  const supplierData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach(r => { agg[r.SupplierID] = (agg[r.SupplierID] || 0) + r.Number; });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  const customerData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach(r => { agg[r.CustomerID] = (agg[r.CustomerID] || 0) + r.Number; });
    const sorted = Object.entries(agg).sort((a,b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5).map(([name, value]) => ({ name, value }));
    const others = sorted.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    if (others > 0) top5.push({ name: 'Others', value: others });
    return top5;
  }, [filteredData]);

  const cumulativeData = useMemo(() => {
    let acc = 0;
    return trendData.map(d => {
        acc += d.val;
        return { date: d.date, val: acc };
    });
  }, [trendData]);

  const modelData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.forEach(r => { if(r.Model) agg[r.Model] = (agg[r.Model] || 0) + r.Number; });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const agg = [0,0,0,0,0,0,0];
    filteredData.forEach(r => {
        if (r.parsedDate) {
            agg[r.parsedDate.getDay()] += r.Number;
        }
    });
    return days.map((day, i) => ({ subject: day, A: agg[i], fullMark: Math.max(...agg) }));
  }, [filteredData]);

  const returnsData = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredData.filter(r => r.Number < 0).forEach(r => {
        agg[r.Category] = (agg[r.Category] || 0) + Math.abs(r.Number);
    });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [filteredData]);


  // --- Network Analysis Chart Data ---
  const networkChartsData = useMemo(() => {
    // Default context: Whole network stats
    let contextData = filteredData;
    let title = "Global Network Overview";
    
    // Node context
    if (networkNode) {
        title = `${networkNode.type.toUpperCase()}: ${networkNode.id}`;
        if (networkNode.type === 'supplier') {
            contextData = filteredData.filter(r => r.SupplierID === networkNode.id);
        } else if (networkNode.type === 'category') {
            contextData = filteredData.filter(r => r.Category === networkNode.id);
        } else if (networkNode.type === 'customer') {
            contextData = filteredData.filter(r => r.CustomerID === networkNode.id);
        }
    }

    // Chart 1: Connection Strength (Interactions)
    const interactionAgg: Record<string, number> = {};
    contextData.forEach(r => {
        // Decide what to show based on type
        let key = r.Category; // Default
        if (networkNode?.type === 'supplier') key = r.CustomerID; // Supplier -> Customer
        if (networkNode?.type === 'customer') key = r.SupplierID; // Customer -> Supplier
        if (networkNode?.type === 'category') key = r.SupplierID; // Category -> Supplier
        
        interactionAgg[key] = (interactionAgg[key] || 0) + r.Number;
    });
    const chart1Data = Object.entries(interactionAgg)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 8);

    // Chart 2: Temporal Pulse (Time Series)
    const timeAgg: Record<string, number> = {};
    contextData.forEach(r => {
        const d = r.Deliverdate.substring(4); // MMDD
        timeAgg[d] = (timeAgg[d] || 0) + r.Number;
    });
    const chart2Data = Object.entries(timeAgg)
        .map(([date, val]) => ({ date, val }))
        .sort((a,b) => a.date.localeCompare(b.date));

    // Chart 3: Composition (Products/Models)
    const compAgg: Record<string, number> = {};
    contextData.forEach(r => {
        const key = r.Model || r.DeviceNAME || 'Unknown';
        compAgg[key] = (compAgg[key] || 0) + r.Number;
    });
    const chart3Data = Object.entries(compAgg)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 6);

    return { title, chart1Data, chart2Data, chart3Data };

  }, [filteredData, networkNode]);

  // Styles
  const appStyle = {
    background: `linear-gradient(135deg, ${currentSkin.bgFrom} 0%, ${currentSkin.bgTo} 100%)`,
    color: currentSkin.text,
    fontFamily: currentSkin.font.includes('serif') ? 'serif' : 'sans-serif'
  };

  return (
    <div className={`min-h-screen w-full transition-colors duration-500 ${currentSkin.font} overflow-x-hidden`} style={appStyle}>
      
      {/* --- Sidebar --- */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-black/10 backdrop-blur-xl border-r border-white/20 p-4 flex flex-col z-50 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-8 tracking-tighter">MedFlow<span className="text-yellow-400">WOW</span></h1>
        
        <nav className="flex-1 space-y-2 mb-8">
          {[
            { id: 'dashboard', icon: Lucide.LayoutDashboard, label: t.dashboard },
            { id: 'network', icon: Lucide.Network, label: t.network },
            { id: 'agents', icon: Lucide.Bot, label: t.agents },
            { id: 'quality', icon: Lucide.ShieldCheck, label: t.quality },
            { id: 'data', icon: Lucide.Database, label: t.data },
            { id: 'config', icon: Lucide.Settings, label: t.config },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-white/20 font-bold shadow-lg' : 'hover:bg-white/10 opacity-70 hover:opacity-100'}`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Filters Section */}
        <div className="mb-8">
           <button 
                onClick={() => setShowFilters(!showFilters)} 
                className="w-full flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider mb-2"
           >
               {t.filters} <Lucide.ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}/>
           </button>
           
           {showFilters && (
               <div className="space-y-2 animate-fade-in-down">
                    {[
                        { key: 'searchSupplier', placeholder: 'Supplier ID' },
                        { key: 'category', placeholder: 'Category' },
                        { key: 'licenseNo', placeholder: 'License No' },
                        { key: 'model', placeholder: 'Model' },
                        { key: 'lotNo', placeholder: 'Lot NO' },
                        { key: 'serNo', placeholder: 'SN / Serial' },
                        { key: 'customerID', placeholder: 'Customer ID' },
                        { key: 'timeZone', placeholder: 'Time Zone (Optional)' },
                    ].map(f => (
                        <input
                            key={f.key}
                            placeholder={f.placeholder}
                            value={(filters as any)[f.key]}
                            onChange={(e) => setFilters({...filters, [f.key]: e.target.value})}
                            className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:border-white/40 placeholder-white/30"
                        />
                    ))}
               </div>
           )}
        </div>

        <div className="space-y-4 pt-6 border-t border-white/10">
            {/* Jackpot & Skin */}
            <div className="flex gap-2">
                <Button onClick={handleJackpot} className="w-full text-xs" variant="secondary"><Lucide.Dices size={14}/> {t.jackpot}</Button>
            </div>
            
            {/* Controls */}
            <div className="flex justify-between items-center gap-2">
                 <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
                    {theme === 'dark' ? <Lucide.Sun size={18}/> : <Lucide.Moon size={18}/>}
                 </button>
                 <button onClick={() => setLang(lang === 'en' ? 'zh-TW' : 'en')} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 font-mono text-xs">
                    {lang === 'en' ? 'EN' : '中'}
                 </button>
            </div>

            {/* API Key */}
            <div className="relative group">
                <Lucide.Key size={14} className="absolute left-3 top-3 opacity-50"/>
                <input 
                    type="password" 
                    placeholder={t.apiKeyPlaceholder}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-lg py-2 pl-8 pr-2 text-xs focus:outline-none focus:border-white/40 placeholder-white/30"
                />
            </div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="ml-64 p-8 min-h-screen">
        
        {/* Status Rail */}
        <header className="mb-8 flex items-center justify-between glass-panel p-3 rounded-full border border-white/10">
            <div className="flex items-center gap-4 px-4 text-xs font-mono opacity-80">
                <span className="flex items-center gap-1"><Lucide.Database size={12}/> {filteredData.length} / {metrics ? metrics.totalRows : 0} Rows</span>
                <span className="h-4 w-px bg-white/20"/>
                <span className="flex items-center gap-1"><Lucide.Palette size={12}/> {currentSkin.name}</span>
                <span className="h-4 w-px bg-white/20"/>
                <span className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-400' : 'bg-red-400'}`}/> 
                    {apiKey ? 'API Ready' : 'Key Missing'}
                </span>
            </div>
        </header>

        {/* Tab Content */}
        <div className="animate-fade-in-up">
            
            {/* --- DASHBOARD --- */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-4 gap-6">
                        <Card className={`bg-[${currentSkin.cardBg}]`}>
                            <h3 className="text-sm opacity-70 mb-1">{t.rows}</h3>
                            <p className="text-3xl font-bold">{filteredData.length.toLocaleString()}</p>
                        </Card>
                        <Card className={`bg-[${currentSkin.cardBg}]`}>
                            <h3 className="text-sm opacity-70 mb-1">{t.units}</h3>
                            <p className="text-3xl font-bold text-green-400">{filteredData.reduce((acc, r) => acc + r.Number, 0).toLocaleString()}</p>
                        </Card>
                        <Card className={`bg-[${currentSkin.cardBg}]`}>
                            <h3 className="text-sm opacity-70 mb-1">{t.suppliers}</h3>
                            <p className="text-3xl font-bold">{new Set(filteredData.map(r => r.SupplierID)).size}</p>
                        </Card>
                        <Card className={`bg-[${currentSkin.cardBg}]`}>
                            <h3 className="text-sm opacity-70 mb-1">{t.categories}</h3>
                            <p className="text-3xl font-bold">{new Set(filteredData.map(r => r.Category)).size}</p>
                        </Card>
                    </div>

                    {/* Chart Grid Row 1 */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* Trend Chart (Line) */}
                        <Card className="col-span-2 min-h-[350px]">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.TrendingUp size={18}/> Daily Volume Trend</h3>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                        <XAxis dataKey="date" stroke="currentColor" style={{fontSize: 10}} tickFormatter={(val) => val.slice(4)}/>
                                        <YAxis stroke="currentColor" style={{fontSize: 10}}/>
                                        <ReTooltip 
                                            contentStyle={{backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px'}}
                                            itemStyle={{color: '#fff'}}
                                        />
                                        <Line type="monotone" dataKey="val" stroke={currentSkin.accent} strokeWidth={3} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Top Categories (Bar) */}
                        <Card className="col-span-1 min-h-[350px]">
                             <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.BarChart2 size={18}/> Top Categories</h3>
                             <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={catData}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} stroke="currentColor" style={{fontSize: 10}}/>
                                        <ReTooltip cursor={{fill: 'rgba(255,255,255,0.1)'}} contentStyle={{backgroundColor: '#000', borderRadius: '8px', border:'none'}}/>
                                        <Bar dataKey="value" fill={currentSkin.accent} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                             </div>
                        </Card>
                    </div>

                    {/* Chart Grid Row 2: NEW CHARTS */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* 1. Supplier Performance */}
                        <Card className="col-span-1 min-h-[300px]">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.Truck size={18}/> Top Suppliers</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={supplierData}>
                                        <XAxis dataKey="name" hide />
                                        <YAxis stroke="currentColor" style={{fontSize: 10}} />
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                        <Bar dataKey="value" fill="#F472B6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* 2. Cumulative Growth */}
                        <Card className="col-span-1 min-h-[300px]">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.TrendingUp size={18}/> Cumulative Growth</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cumulativeData}>
                                        <defs>
                                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={currentSkin.accent} stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor={currentSkin.accent} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                        <Area type="monotone" dataKey="val" stroke={currentSkin.accent} fillOpacity={1} fill="url(#colorVal)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                         {/* 3. Customer Share */}
                         <Card className="col-span-1 min-h-[300px]">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.PieChart size={18}/> Customer Distribution</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={customerData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                                            {customerData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                            ))}
                                        </Pie>
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    {/* Chart Grid Row 3: NEW CHARTS */}
                    <div className="grid grid-cols-3 gap-6">
                        {/* 4. Model Stats */}
                        <Card className="col-span-1 min-h-[300px]">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.Box size={18}/> Top Models</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={modelData}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} stroke="currentColor" style={{fontSize: 9}} tickFormatter={(val) => val.substring(0, 10)}/>
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                        <Bar dataKey="value" fill="#60A5FA" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* 5. Weekly Radar */}
                        <Card className="col-span-1 min-h-[300px]">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Lucide.Calendar size={18}/> Weekly Activity</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dayOfWeekData}>
                                        <PolarGrid stroke="rgba(255,255,255,0.2)" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'currentColor', fontSize: 10 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 'auto']} hide/>
                                        <Radar name="Units" dataKey="A" stroke={currentSkin.accent} fill={currentSkin.accent} fillOpacity={0.6} />
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* 6. Returns */}
                        <Card className="col-span-1 min-h-[300px]">
                             <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400"><Lucide.AlertCircle size={18}/> Returns by Category</h3>
                             <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={returnsData}>
                                        <XAxis dataKey="name" stroke="currentColor" style={{fontSize: 9}} tickFormatter={(val) => val.substring(0,5)} />
                                        <YAxis stroke="currentColor" style={{fontSize: 10}}/>
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                        <Bar dataKey="value" fill="#F87171" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                             </div>
                        </Card>
                    </div>

                    {/* Suggested Analysis */}
                    <Card className="border-t-4 border-yellow-400">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Lucide.Sparkles size={20} className="text-yellow-400"/> Smart Analyst: 20 Follow-up Questions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <div key={i} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-xs flex items-start gap-2 cursor-pointer group"
                                     onClick={() => {
                                         // Copy to clipboard or set as agent prompt (For now just visual feedback)
                                         navigator.clipboard.writeText(q);
                                     }}
                                >
                                    <span className="opacity-50 font-mono">{(i+1).toString().padStart(2, '0')}</span>
                                    <span className="group-hover:text-yellow-200">{q}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-center text-xs opacity-40 mt-4">Click any question to copy to clipboard for Agent analysis</p>
                    </Card>
                </div>
            )}

            {/* --- NETWORK --- */}
            {activeTab === 'network' && (
                <div className="h-[80vh] w-full flex gap-6">
                    {/* Graph Area */}
                    <div className="flex-grow h-full flex flex-col gap-4">
                        <Card className="flex-1 p-0 overflow-hidden relative">
                            <div className="absolute top-4 left-4 z-10 glass-panel px-4 py-2 rounded-lg pointer-events-auto">
                                <h3 className="font-bold mb-2 text-sm">{t.network} Settings</h3>
                                <label className="text-xs block mb-1">Top N: {filters.topN}</label>
                                <input type="range" min="5" max="50" value={filters.topN} onChange={(e) => setFilters({...filters, topN: parseInt(e.target.value)})} className="w-full accent-white"/>
                            </div>
                            <NetworkGraph 
                                data={filteredData} 
                                topN={filters.topN} 
                                width={800} 
                                height={800}
                                onNodeClick={setNetworkNode}
                                selectedNodeId={networkNode?.id}
                            />
                        </Card>
                    </div>
                    
                    {/* Analytics Sidebar */}
                    <div className="w-[400px] flex flex-col gap-4 overflow-y-auto">
                        <Card className="bg-white/5 border-l-4 border-l-yellow-400">
                             <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xs font-bold uppercase opacity-50 mb-1">Active Context</h3>
                                    <h2 className="text-lg font-bold truncate max-w-[250px]">
                                        {networkChartsData.title}
                                    </h2>
                                </div>
                                {networkNode && (
                                    <button onClick={() => setNetworkNode(null)} className="p-1 hover:bg-white/10 rounded">
                                        <Lucide.X size={16}/>
                                    </button>
                                )}
                             </div>
                        </Card>

                        {/* Chart 1: Connection Strength */}
                        <Card className="min-h-[200px]">
                            <h4 className="text-xs font-bold uppercase opacity-70 mb-2">
                                {networkNode ? "Top Connections" : "Network Hubs"}
                            </h4>
                            <div className="h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={networkChartsData.chart1Data}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={80} stroke="currentColor" style={{fontSize: 9}} tickFormatter={(v) => v.substring(0,10)}/>
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                        <Bar dataKey="value" fill={chartColors[0]} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Chart 2: Temporal Pulse */}
                        <Card className="min-h-[200px]">
                            <h4 className="text-xs font-bold uppercase opacity-70 mb-2">
                                {networkNode ? "Activity Pulse" : "Network Rhythm"}
                            </h4>
                            <div className="h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={networkChartsData.chart2Data}>
                                        <defs>
                                            <linearGradient id="netPulse" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={chartColors[1]} stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor={chartColors[1]} stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="date" hide />
                                        <YAxis hide />
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                        <Area type="monotone" dataKey="val" stroke={chartColors[1]} fill="url(#netPulse)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Chart 3: Composition */}
                        <Card className="min-h-[200px]">
                             <h4 className="text-xs font-bold uppercase opacity-70 mb-2">
                                {networkNode ? "Product Mix" : "Model Diversity"}
                            </h4>
                            <div className="h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={networkChartsData.chart3Data} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={5} dataKey="value">
                                            {networkChartsData.chart3Data.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                                            ))}
                                        </Pie>
                                        <ReTooltip contentStyle={{backgroundColor: '#000', border: 'none', borderRadius: '8px'}}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- AGENTS --- */}
            {activeTab === 'agents' && (
                <div className="grid grid-cols-3 gap-6 h-[80vh]">
                     {/* Pipeline View */}
                     <div className="col-span-1 space-y-4 overflow-y-auto pr-2">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Pipeline</h2>
                            <Button onClick={runPipeline} disabled={!apiKey} className="text-xs">
                                <Lucide.Play size={14}/> {t.runPipeline}
                            </Button>
                        </div>
                        {pipeline?.agents.map((step, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border transition-all ${step.status === 'running' ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-xs opacity-50">{step.id}</span>
                                    {step.status === 'completed' && <Lucide.CheckCircle2 className="text-green-400" size={16}/>}
                                    {step.status === 'running' && <Lucide.Loader2 className="animate-spin text-yellow-400" size={16}/>}
                                </div>
                                <h3 className="font-bold text-sm mb-1">{step.name}</h3>
                                <p className="text-xs opacity-60 mb-3">{step.model}</p>
                                <Button size={12} variant="secondary" onClick={() => runAgentStep(idx)} disabled={!apiKey || step.status === 'running'} className="w-full text-xs py-1">
                                    {t.runStep}
                                </Button>
                            </div>
                        ))}
                     </div>

                     {/* Output View */}
                     <div className="col-span-2">
                        <Card className="h-full flex flex-col">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><Lucide.Terminal size={18}/> Agent Output</h3>
                            <div className="flex-1 bg-black/30 rounded-lg p-4 font-mono text-sm overflow-y-auto whitespace-pre-wrap">
                                {pipeline?.agents.find(a => a.status === 'completed' || a.status === 'running')?.output || "Waiting for execution..."}
                            </div>
                        </Card>
                     </div>
                </div>
            )}

             {/* --- DATA QUALITY --- */}
             {activeTab === 'quality' && metrics && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold mb-4">Data Quality Report</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <Card>
                             <h3 className="text-lg font-bold mb-4 text-red-300">Issues detected</h3>
                             <ul className="space-y-2">
                                <li className="flex justify-between border-b border-white/10 pb-2">
                                    <span>Parse Failures</span>
                                    <span className="font-mono">{metrics.parseFailures}</span>
                                </li>
                                <li className="flex justify-between border-b border-white/10 pb-2">
                                    <span>Missing Dates</span>
                                    <span className="font-mono">{metrics.totalRows - (metrics.dateRange[0] ? metrics.totalRows : 0) }</span>
                                </li>
                             </ul>
                        </Card>
                        <Card>
                             <h3 className="text-lg font-bold mb-4 text-blue-300">Context Preview (LLM)</h3>
                             <pre className="text-xs font-mono bg-black/40 p-4 rounded overflow-x-auto">
                                {JSON.stringify({
                                   rows: metrics.totalRows,
                                   units: metrics.totalUnits,
                                   sample: data.slice(0, 2)
                                }, null, 2)}
                             </pre>
                             <p className="text-xs opacity-50 mt-2 text-right">Estimated Tokens: ~150</p>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- DATA MGR --- */}
            {activeTab === 'data' && (
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Controls */}
                    <div className="flex gap-4">
                        <Card className="flex-1 border-dashed border-2 bg-white/5 hover:bg-white/10 cursor-pointer flex flex-col items-center justify-center gap-4 min-h-[150px]"
                             onClick={() => fileInputRef.current?.click()}>
                            <Lucide.UploadCloud size={40} className="opacity-50"/>
                            <p className="text-sm font-medium">{t.dropFile}</p>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".csv,.json,.txt"
                                onChange={handleFileUpload}
                            />
                        </Card>
                        <Card className="flex-1 flex flex-col items-center justify-center gap-4 min-h-[150px]">
                            <Button variant="secondary" onClick={handleLoadDefault} className="w-full">
                                <Lucide.Database size={16}/> {t.loadDefault}
                            </Button>
                             <div className="w-full h-px bg-white/10"/>
                             <div className="flex gap-2 w-full">
                                 <Button variant="danger" onClick={() => setInputText('')} className="flex-1">Clear</Button>
                                 <Button onClick={handleParse} disabled={isParsing} className="flex-1">
                                    {isParsing ? t.parsing : t.parse}
                                </Button>
                             </div>
                        </Card>
                    </div>

                    {/* Preview Area */}
                    <div className="grid grid-cols-2 gap-6 h-[500px]">
                        <Card className="flex flex-col">
                            <h3 className="font-bold mb-2">Raw Input</h3>
                            <textarea 
                                className="flex-1 bg-black/20 border border-white/20 rounded-lg p-4 font-mono text-xs focus:outline-none focus:border-white/50 resize-none"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </Card>
                        <Card className="flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold">{t.preview}</h3>
                                <select 
                                    className="bg-black/30 border border-white/20 rounded text-xs p-1"
                                    value={previewRows}
                                    onChange={(e) => setPreviewRows(Number(e.target.value))}
                                >
                                    <option value="10">10 Rows</option>
                                    <option value="20">20 Rows</option>
                                    <option value="50">50 Rows</option>
                                    <option value="100">100 Rows</option>
                                </select>
                            </div>
                            <div className="flex-1 overflow-auto bg-black/20 rounded-lg border border-white/10">
                                {data.length > 0 ? (
                                    <table className="w-full text-xs text-left">
                                        <thead className="sticky top-0 bg-black/80 backdrop-blur-md z-10">
                                            <tr>
                                                <th className="p-2 border-b border-white/10">Date</th>
                                                <th className="p-2 border-b border-white/10">Supplier</th>
                                                <th className="p-2 border-b border-white/10">Category</th>
                                                <th className="p-2 border-b border-white/10">Model</th>
                                                <th className="p-2 border-b border-white/10">Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.slice(0, previewRows).map((row, i) => (
                                                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                    <td className="p-2 font-mono whitespace-nowrap opacity-70">{row.Deliverdate}</td>
                                                    <td className="p-2">{row.SupplierID}</td>
                                                    <td className="p-2">{row.Category}</td>
                                                    <td className="p-2">{row.Model}</td>
                                                    <td className="p-2 font-mono text-right">{row.Number}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex items-center justify-center opacity-30 italic">
                                        {t.noData}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- CONFIG --- */}
            {activeTab === 'config' && (
                <div className="grid grid-cols-2 gap-6 h-[80vh]">
                    <Card className="flex flex-col">
                        <h3 className="font-bold mb-2">agents.yaml</h3>
                        <textarea 
                            className="flex-1 bg-black/20 border border-white/20 rounded p-4 font-mono text-xs resize-none focus:outline-none"
                            value={agentsYaml}
                            onChange={(e) => setAgentsYaml(e.target.value)}
                        />
                    </Card>
                    <Card className="flex flex-col">
                        <h3 className="font-bold mb-2">SKILL.md</h3>
                        <textarea 
                            className="flex-1 bg-black/20 border border-white/20 rounded p-4 font-mono text-xs resize-none focus:outline-none"
                            value={skillMd}
                            onChange={(e) => setSkillMd(e.target.value)}
                        />
                    </Card>
                </div>
            )}

        </div>
      </main>
    </div>
  );
}