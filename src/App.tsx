import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  MapPin, 
  Phone, 
  User, 
  GraduationCap, 
  Clock,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building2,
  LogIn,
  LogOut,
  Search,
  Filter,
  Download,
  Upload,
  Globe,
  ExternalLink
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, getDocFromServer, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';

// --- Types & Schema ---

const applicationSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  country: z.string().min(1, "Please select a country"),
  industry: z.string().min(1, "Please select an industry"),
  degreeType: z.string().min(1, "Please select a degree type"),
  school: z.string().min(2, "School/University name is required"),
  major: z.string().min(2, "Major is required"),
  yearsOfExperience: z.string().min(1, "Please select your experience level"),
  location: z.string().min(2, "Location is required"),
  phoneNumber: z.string().min(5, "Valid phone number is required"),
  cvFile: z.any().refine((files) => files?.length > 0, "CV file is required"),
  agreedToPolicy: z.boolean().refine(val => val === true, {
    message: "You must agree to the policy to submit",
  }),
});

type ApplicationForm = z.infer<typeof applicationSchema>;

const COUNTRIES = ["Jordan", "UAE"];

const DEGREE_TYPES = [
  "High School",
  "Bachelor's",
  "Master's",
  "PhD",
  "Other"
];

const INDUSTRIES = [
  "Information Technology",
  "Healthcare",
  "Finance & Banking",
  "Education",
  "Construction & Engineering",
  "Retail & Wholesale",
  "Hospitality & Tourism",
  "Manufacturing",
  "Marketing & Advertising",
  "Logistics & Supply Chain",
  "Other"
];

const EXPERIENCE_LEVELS = [
  "0-1",
  "1-3",
  "3-5",
  "5-10",
  "More than 10 years"
];

const ADMIN_EMAILS = ["twalmoneer@gmail.com", "recruitment@jobssharinghub.com"];

// --- Components ---

const InputField = React.forwardRef(({ label, icon: Icon, error, ...props }: any, ref: any) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
      <Icon size={16} className="text-gray-400" />
      {label}
    </label>
    <input
      {...props}
      ref={ref}
      className={`w-full px-4 py-2.5 bg-white border rounded-xl transition-all outline-none focus:ring-2 focus:ring-blue-500/20 ${
        error ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'
      }`}
    />
    {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {error.message}</p>}
  </div>
));

const SelectField = React.forwardRef(({ label, icon: Icon, options, error, ...props }: any, ref: any) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
      <Icon size={16} className="text-gray-400" />
      {label}
    </label>
    <div className="relative">
      <select
        {...props}
        ref={ref}
        className={`w-full px-4 py-2.5 bg-white border rounded-xl transition-all outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'
        }`}
      >
        <option value="">Select an option</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <ChevronRight size={16} className="rotate-90" />
      </div>
    </div>
    {error && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {error.message}</p>}
  </div>
));

// --- Admin Panel Component ---

const AdminPanel = ({ user }: { user: any }) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterExperience, setFilterExperience] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'categorized'>('list');

  useEffect(() => {
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(docs);
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredApps = applications.filter(app => {
    const matchesSearch = `${app.firstName} ${app.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCountry = filterCountry === '' || app.country === filterCountry;
    const matchesIndustry = filterIndustry === '' || app.industry === filterIndustry;
    const matchesExperience = filterExperience === '' || app.yearsOfExperience === filterExperience;

    return matchesSearch && matchesCountry && matchesIndustry && matchesExperience;
  });

  const exportToCSV = () => {
    const headers = ["First Name", "Last Name", "Country", "Industry", "Degree", "School", "Major", "Experience", "Location", "Phone", "CV URL", "Date"];
    const rows = filteredApps.map(app => [
      app.firstName,
      app.lastName,
      app.country,
      app.industry,
      app.degreeType,
      app.school,
      app.major,
      app.yearsOfExperience,
      app.location,
      app.phoneNumber,
      app.cvUrl,
      app.createdAt?.toDate ? new Date(app.createdAt.toDate()).toLocaleDateString() : 'Pending'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `applications_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategorizedData = () => {
    const tree: any = {};
    filteredApps.forEach(app => {
      const country = app.country || 'Unknown';
      const industry = app.industry || 'Unknown';
      const exp = app.yearsOfExperience || 'Unknown';

      if (!tree[country]) tree[country] = {};
      if (!tree[country][industry]) tree[country][industry] = {};
      if (!tree[country][industry][exp]) tree[country][industry][exp] = [];
      
      tree[country][industry][exp].push(app);
    });
    return tree;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Briefcase size={22} className="text-white" />
            </div>
            <h1 className="font-bold text-xl">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-900">{user.displayName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 bg-white p-1 border border-gray-200 rounded-xl">
              <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                List View
              </button>
              <button 
                onClick={() => setViewMode('categorized')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'categorized' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Categorized View
              </button>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={exportToCSV}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by name, industry, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
              <select 
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Countries</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Industries</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select 
                value={filterExperience}
                onChange={(e) => setFilterExperience(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Experience</option>
                {EXPERIENCE_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="text-blue-600 animate-spin" />
            <p className="text-gray-500 font-medium">Loading applications...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-3xl p-20 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
              <FileText size={32} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No applications found</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your search or filters to find what you're looking for.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Candidate</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Education</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Categorization</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">CV</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                            {app.firstName[0]}{app.lastName[0]}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{app.firstName} {app.lastName}</p>
                            <p className="text-xs text-gray-500">{app.location}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-gray-900">{app.degreeType}</p>
                          <p className="text-xs text-gray-500">{app.major} at {app.school}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 uppercase">
                            {app.country}
                          </span>
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">
                            {app.industry}
                          </span>
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 uppercase">
                            {app.yearsOfExperience} yrs
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-medium">{app.phoneNumber}</td>
                      <td className="px-6 py-4">
                        <a 
                          href={app.cvUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-gray-100 hover:bg-blue-600 hover:text-white rounded-lg transition-all flex items-center justify-center w-fit"
                          title="View CV"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {app.createdAt?.toDate ? new Date(app.createdAt.toDate()).toLocaleDateString() : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(getCategorizedData()).map(([country, industries]: [string, any]) => (
              <div key={country} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                  <Globe size={18} className="text-blue-600" />
                  <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm">{country}</h3>
                </div>
                <div className="p-6 space-y-6">
                  {Object.entries(industries).map(([industry, experiences]: [string, any]) => (
                    <div key={industry} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-gray-400" />
                        <h4 className="font-bold text-gray-700 text-sm">{industry}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6">
                        {Object.entries(experiences).map(([exp, apps]: [string, any]) => (
                          <div key={exp} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{exp} Years</span>
                              <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{apps.length}</span>
                            </div>
                            <div className="space-y-2">
                              {apps.map((app: any) => (
                                <div key={app.id} className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between group">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold text-[10px]">
                                      {app.firstName[0]}{app.lastName[0]}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">{app.firstName} {app.lastName}</span>
                                  </div>
                                  <a 
                                    href={app.cvUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-blue-600 hover:text-white rounded-lg transition-all text-gray-400"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ApplicationForm>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      agreedToPolicy: false
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (err: any) {
        if (err.message?.includes('the client is offline')) {
          console.error("Firebase configuration error: Client is offline.");
        }
      }
    };
    testConnection();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    if (loginUsername === 'Recruitment' && loginPassword === 'Recruitment@2026') {
      const email = 'recruitment@jobssharinghub.com';
      try {
        // Try to sign in first
        await signInWithEmailAndPassword(auth, email, loginPassword);
        setShowLoginModal(false);
      } catch (err: any) {
        // If user doesn't exist, create it (bootstrapping)
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          try {
            await createUserWithEmailAndPassword(auth, email, loginPassword);
            setShowLoginModal(false);
          } catch (createErr: any) {
            console.error("Account creation error:", createErr);
            setLoginError("Authentication failed. Please try again.");
          }
        } else {
          console.error("Login error:", err);
          setLoginError("Invalid credentials or server error.");
        }
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      setLoginError("Invalid username or password.");
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      setShowLoginModal(false);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const onSubmit = async (data: ApplicationForm) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const file = data.cvFile[0];
      const storageRef = ref(storage, `cvs/${data.country}/${data.industry}/${data.yearsOfExperience}/${Date.now()}_${file.name}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      const cvUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed', 
          null,
          (err) => reject(err),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          }
        );
      });

      const { cvFile, ...formData } = data;

      await addDoc(collection(db, 'applications'), {
        ...formData,
        cvUrl,
        createdAt: serverTimestamp(),
      });
      setIsSuccess(true);
      reset();
    } catch (err: any) {
      console.error("Submission error:", err);
      setError("Failed to submit application. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 size={32} className="text-blue-600 animate-spin" />
      </div>
    );
  }

  // If logged in as admin, show admin panel
  if (user && ADMIN_EMAILS.includes(user.email)) {
    return <AdminPanel user={user} />;
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl shadow-blue-500/5 text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-600 mb-8">
            Thank you for applying. Our team will review your information and get back to you if there's a match.
          </p>
          <button 
            onClick={() => setIsSuccess(false)}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-600/20"
          >
            Submit Another Application
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Briefcase size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Jobs Sharing Hub</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Recruitment Portal</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-gray-500">
            <span>Recruitment Portal</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-12 items-start">
          
          {/* Left Column: Form */}
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">Join Our Talent Pool</h2>
              <p className="text-gray-500 text-lg">Fill in your professional details to get started.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <InputField 
                  label="First Name" 
                  icon={User} 
                  placeholder="John"
                  error={errors.firstName}
                  {...register('firstName')}
                />
                <InputField 
                  label="Last Name" 
                  icon={User} 
                  placeholder="Doe"
                  error={errors.lastName}
                  {...register('lastName')}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <SelectField 
                  label="Country" 
                  icon={Globe} 
                  options={COUNTRIES}
                  error={errors.country}
                  {...register('country')}
                />
                <SelectField 
                  label="Industry" 
                  icon={Building2} 
                  options={INDUSTRIES}
                  error={errors.industry}
                  {...register('industry')}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <SelectField 
                  label="Degree Type" 
                  icon={GraduationCap} 
                  options={DEGREE_TYPES}
                  error={errors.degreeType}
                  {...register('degreeType')}
                />
                <SelectField 
                  label="Years of Experience" 
                  icon={Clock} 
                  options={EXPERIENCE_LEVELS}
                  error={errors.yearsOfExperience}
                  {...register('yearsOfExperience')}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <InputField 
                  label="School / University" 
                  icon={Building2} 
                  placeholder="Harvard University"
                  error={errors.school}
                  {...register('school')}
                />
                <InputField 
                  label="Major" 
                  icon={GraduationCap} 
                  placeholder="Computer Science"
                  error={errors.major}
                  {...register('major')}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <InputField 
                  label="Location" 
                  icon={MapPin} 
                  placeholder="City, Area"
                  error={errors.location}
                  {...register('location')}
                />
                <InputField 
                  label="Phone Number" 
                  icon={Phone} 
                  placeholder="+971 50 000 0000"
                  error={errors.phoneNumber}
                  {...register('phoneNumber')}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Upload size={16} className="text-gray-400" />
                  Upload CV (PDF or Word)
                </label>
                <div className={`relative border-2 border-dashed rounded-2xl p-8 transition-all text-center ${
                  errors.cvFile ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-blue-400 bg-white'
                }`}>
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx"
                    {...register('cvFile')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX (max. 5MB)</p>
                    </div>
                  </div>
                </div>
                {errors.cvFile && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {errors.cvFile.message as string}</p>}
              </div>

              {/* Policy Section */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                  <ShieldCheck size={20} />
                  <h3>Disclaimer & Consent</h3>
                </div>
                
                <div className="text-sm text-gray-600 space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  <p className="font-bold italic">By submitting this form and uploading your CV, you acknowledge and agree to the following:</p>
                  <div className="space-y-4">
                    <div>
                      <p className="font-bold">1. Consent to Share Information</p>
                      <p>You voluntarily provide your personal and professional information and expressly consent to <em>Jobs Sharing Hub</em> collecting, storing, and displaying your CV and related details on its platform, including social media channels, website, and CV gallery, for recruitment and job-matching purposes.</p>
                    </div>
                    <div>
                      <p className="font-bold">2. Purpose of Use</p>
                      <p>Your information will be used <em>solely for employment-related purposes</em>, including sharing your CV with potential employers, recruiters, and hiring companies operating in the UAE, Jordan, and Syria.</p>
                    </div>
                    <div>
                      <p className="font-bold">3. Confidentiality & Data Handling</p>
                      <p>Jobs Sharing Hub is committed to handling your data responsibly and will take reasonable measures to protect your information. However, once your CV is shared with third-party recruiters or employers, <em>Jobs Sharing Hub is not responsible for how those third parties use or store your data</em>.</p>
                    </div>
                    <div>
                      <p className="font-bold">4. Accuracy of Information</p>
                      <p>You confirm that all information provided is <em>true, accurate, and up to date</em>, and you accept full responsibility for the content of your CV and any consequences arising from incorrect or misleading information.</p>
                    </div>
                    <div>
                      <p className="font-bold">5. No Employment Guarantee</p>
                      <p>Submission of your CV <em>does not guarantee employment, interviews, or job offers. Jobs Sharing Hub acts solely as a job-sharing and facilitation platform and is <strong>not an employer or recruitment agency</strong></em>.</p>
                    </div>
                    <div>
                      <p className="font-bold">6. Right to Remove Data</p>
                      <p>You may request the removal of your CV and personal data from our platform at any time by contacting us through our official channels. Removal will be processed within a reasonable timeframe.</p>
                    </div>
                    <div>
                      <p className="font-bold">7. No Fees Policy</p>
                      <p>Jobs Sharing Hub <em>does not charge job seekers any fees</em> for CV submission or job sharing. Any communication requesting payment in our name should be reported immediately.</p>
                    </div>
                    <div>
                      <p className="font-bold">8. Acceptance of Terms</p>
                      <p>By submitting this form, you confirm that you have read, understood, and agreed to this disclaimer and consent to the processing and sharing of your information as described above.</p>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer group pt-2">
                  <div className="relative flex items-center mt-0.5">
                    <input 
                      type="checkbox" 
                      {...register('agreedToPolicy')}
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:bg-blue-600 checked:border-blue-600"
                    />
                    <CheckCircle2 className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                    I have read, understood, and agree to the disclaimer and consent to the processing of my information.
                  </span>
                </label>
                {errors.agreedToPolicy && (
                  <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {errors.agreedToPolicy.message}</p>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    Submit My Application
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Info Card */}
          <aside className="space-y-6 lg:sticky lg:top-28">
            <div className="bg-blue-600 rounded-3xl p-8 text-white shadow-2xl shadow-blue-600/30 relative overflow-hidden">
              <div className="relative z-10 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Jobs Sharing Hub</h3>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    Your gateway to professional opportunities in the Middle East.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {[
                    { icon: ShieldCheck, text: "Secure Data Handling" },
                    { icon: Building2, text: "Direct Employer Access" },
                    { icon: MapPin, text: "Regional Opportunities" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                        <item.icon size={16} />
                      </div>
                      <span className="text-sm font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Decorative circles */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl"></div>
            </div>
          </aside>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-gray-100 text-center space-y-4">
        <p className="text-sm text-gray-400 font-medium">
          &copy; {new Date().getFullYear()} Jobs Sharing Hub. All rights reserved.
        </p>
        <div className="flex items-center justify-center gap-6 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Contact</a>
        </div>
        <div className="pt-4">
          <button 
            onClick={() => setShowLoginModal(true)}
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors flex items-center gap-1 mx-auto"
          >
            <LogIn size={12} /> Recruitment Portal Login
          </button>
        </div>
      </footer>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-blue-600/20">
                    <Briefcase size={24} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Recruitment Portal</h2>
                  <p className="text-sm text-gray-500">Sign in to access candidate CVs and submissions.</p>
                </div>

                <form onSubmit={handleAdminLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <input 
                      type="text"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Recruitment"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Password</label>
                    <input 
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      required
                    />
                  </div>

                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs">
                      <AlertCircle size={14} />
                      {loginError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    {isLoggingIn ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                    Login
                  </button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400 font-medium">Or continue with</span>
                  </div>
                </div>

                <button 
                  onClick={handleGoogleLogin}
                  className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                  Google Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
