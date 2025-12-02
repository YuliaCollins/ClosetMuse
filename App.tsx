import React, { useState, useEffect } from 'react';
import { AppView, UserProfile, StyledLook, StylingRequest } from './types';
import { generateStylingAdvice } from './services/geminiService';
import { VIBE_PRESETS, BUDGET_RANGES } from './constants';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [isLoading, setIsLoading] = useState(false);
  
  // Profile State
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    height: '',
    weight: '',
    sizes: '',
    vibe: '',
    celebrityInspo: '',
    budget: BUDGET_RANGES[1],
    preferredBrands: '',
    description: '',
    notes: ''
  });

  // Result & Saved State
  const [result, setResult] = useState<StyledLook | null>(null);
  const [savedLooks, setSavedLooks] = useState<StyledLook[]>(() => {
    try {
      const saved = localStorage.getItem('closet_muse_wardrobe');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load saved looks", e);
      return [];
    }
  });

  // Persist saved looks with Error Handling (Quota Limits)
  useEffect(() => {
    try {
      localStorage.setItem('closet_muse_wardrobe', JSON.stringify(savedLooks));
    } catch (e: any) {
      console.error("LocalStorage Save Failed:", e);
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        alert("Your wardrobe is full! We'll try to save this look without the image to save space.");
        
        // Retry saving without the base64 image to save space
        const textOnlyLooks = savedLooks.map(l => {
           // If it's the most recent one (likely the cause), strip image
           if (l.id === savedLooks[0].id) {
             const { generatedImage, ...rest } = l;
             return rest;
           }
           return l;
        });
        
        try {
           localStorage.setItem('closet_muse_wardrobe', JSON.stringify(textOnlyLooks));
           setSavedLooks(textOnlyLooks); // Update state to match storage
        } catch (retryError) {
           alert("Storage is completely full. Please delete some old looks to save new ones.");
        }
      }
    }
  }, [savedLooks]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handlePresetClick = (preset: string) => {
    setProfile(prev => ({
      ...prev,
      vibe: prev.vibe ? `${prev.vibe}, ${preset}` : preset
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setView(AppView.LOADING);
    try {
      const request: StylingRequest = { profile };
      const look = await generateStylingAdvice(request);
      setResult(look);
      setView(AppView.RESULT);
    } catch (error) {
      console.error(error);
      alert("Something went wrong with the stylist AI. Please try again.");
      setView(AppView.FORM);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLook = (lookToSave: StyledLook) => {
    const newLook = {
      ...lookToSave,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString()
    };
    setSavedLooks(prev => [newLook, ...prev]);
  };

  const handleDeleteLook = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedLooks(prev => prev.filter(look => look.id !== id));
  };

  const handleViewSavedLook = (look: StyledLook) => {
    setResult(look);
    setView(AppView.RESULT);
  };

  const handleEditLook = (look: StyledLook) => {
    if (look.originalProfile) {
      setProfile(look.originalProfile);
    }
    setView(AppView.FORM);
  };

  // Generic Share Function
  const handleShare = async (title: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `${text}\n\nStyled by MyClosetMuse.com`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Website link copied to clipboard!');
      } catch (err) {
        alert('Share this link: ' + window.location.href);
      }
    }
  };

  return (
    <div className="min-h-screen bg-muse-black text-muse-white font-sans selection:bg-muse-silver selection:text-muse-black overflow-x-hidden max-w-[100vw] w-full flex flex-col">
      {/* Global Header */}
      <nav className="fixed top-0 w-full p-4 md:p-6 flex justify-between items-center z-50 bg-gradient-to-b from-muse-black to-transparent max-w-[100vw]">
        <div className="text-xl md:text-2xl font-serif tracking-widest uppercase cursor-pointer whitespace-nowrap" onClick={() => setView(AppView.LANDING)}>
          Closet Muse
        </div>
        <div className="flex gap-4 md:gap-6 items-center">
          <button 
             onClick={() => setView(AppView.SAVED)}
             className={`text-xs md:text-sm tracking-wider transition-colors whitespace-nowrap ${view === AppView.SAVED ? 'text-muse-white font-bold border-b border-muse-white' : 'text-muse-silver hover:text-muse-white'}`}
          >
            WARDROBE ({savedLooks.length})
          </button>
          {view === AppView.RESULT && (
            <button 
              onClick={() => setView(AppView.FORM)}
              className="text-xs md:text-sm tracking-wider hover:text-muse-silver transition-colors whitespace-nowrap"
            >
              NEW LOOK
            </button>
          )}
        </div>
      </nav>

      {/* View Router */}
      <main className="pt-24 px-4 md:px-8 max-w-7xl mx-auto flex-grow flex flex-col w-full">
        {view === AppView.LANDING && <LandingView onStart={() => setView(AppView.FORM)} />}
        {view === AppView.FORM && (
          <FormView 
            profile={profile} 
            onChange={handleInputChange} 
            onSubmit={handleSubmit}
            setProfile={setProfile}
            onPresetClick={handlePresetClick}
          />
        )}
        {view === AppView.LOADING && <LoadingView />}
        {view === AppView.RESULT && result && (
          <ResultView 
            look={result} 
            onSave={handleSaveLook} 
            onEdit={handleEditLook}
            onShare={handleShare}
            isSaved={savedLooks.some(l => l.title === result.title && l.description === result.description)} 
          />
        )}
        {view === AppView.SAVED && (
          <SavedLooksView 
            looks={savedLooks} 
            onViewLook={handleViewSavedLook}
            onDeleteLook={handleDeleteLook}
            onNewLook={() => setView(AppView.FORM)}
            onShare={handleShare}
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="w-full py-8 text-center border-t border-muse-gray/30 mt-12 z-10 bg-muse-black shrink-0">
        <p className="text-muse-silver text-[10px] md:text-xs tracking-[0.2em] uppercase">
          &copy; {new Date().getFullYear()} MyClosetMuse.com
        </p>
      </footer>
    </div>
  );
};

// --- Sub-Components ---

const LandingView: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in pb-20 w-full px-2">
    <h1 className="text-4xl md:text-7xl font-serif mb-6 leading-tight break-words max-w-full">
      Curated by <span className="italic text-muse-silver">Intelligence</span>.
      <br />
      Defined by <span className="italic text-muse-silver">You</span>.
    </h1>
    <p className="text-muse-silver text-sm md:text-xl max-w-2xl mb-12 font-light px-2 break-words">
      Your personal AI stylist. Describe your event, define your vibe, and get curated outfits with makeup suggestions and direct shopping links.
    </p>
    <button
      onClick={onStart}
      className="bg-muse-white text-muse-black px-10 py-4 text-xs md:text-sm font-bold tracking-[0.2em] hover:bg-muse-silver transition-colors uppercase"
    >
      Enter Closet Muse
    </button>
  </div>
);

interface FormViewProps {
  profile: UserProfile;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onPresetClick: (preset: string) => void;
}

const FormView: React.FC<FormViewProps> = ({ profile, onChange, onSubmit, onPresetClick }) => {
  return (
    <div className="animate-slide-up max-w-4xl mx-auto w-full pb-20">
      <div className="mb-12 border-b border-muse-gray pb-8">
        <h2 className="text-2xl md:text-3xl font-serif italic mb-2">The Brief</h2>
        <p className="text-muse-silver text-sm md:text-base">Tell us about yourself and the look you need.</p>
      </div>

      <div className="space-y-12">
        {/* Main Description */}
        <section>
          <label className="block text-xs md:text-sm font-bold uppercase tracking-widest mb-4">
            What are you looking for? (The Request)
          </label>
          <textarea
            name="description"
            value={profile.description}
            onChange={onChange}
            placeholder="e.g. I need a chic outfit for a gallery opening in London. It's cold, so I need layers, but I want to look edgy and sophisticated. Maybe leather styling?"
            className="w-full bg-muse-dark border border-muse-gray p-4 md:p-6 text-sm md:text-lg focus:outline-none focus:border-muse-white transition-colors h-40 resize-none"
          />
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <InputGroup label="Height" name="height" value={profile.height} onChange={onChange} placeholder="e.g. 5'7" />
          <InputGroup label="Weight" name="weight" value={profile.weight} onChange={onChange} placeholder="e.g. 140 lbs" />
          <InputGroup label="Sizes" name="sizes" value={profile.sizes} onChange={onChange} placeholder="e.g. US 6, Medium" />
        </section>

        {/* Vibe */}
        <section>
          <label className="block text-xs md:text-sm font-bold uppercase tracking-widest mb-4">The Vibe</label>
          <textarea
            name="vibe"
            value={profile.vibe}
            onChange={onChange}
            placeholder="Describe your style (e.g. minimal, colorful, rockstar gf)"
            className="w-full bg-muse-dark border border-muse-gray p-4 text-muse-white mb-4 focus:outline-none focus:border-muse-white transition-colors h-24"
          />
          <div className="flex flex-wrap gap-2">
            {VIBE_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => onPresetClick(v)}
                className="px-3 py-2 border border-muse-gray text-[10px] md:text-xs uppercase tracking-wider hover:bg-muse-white hover:text-muse-black transition-colors"
              >
                + {v}
              </button>
            ))}
          </div>
        </section>

        {/* Details */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block text-xs md:text-sm font-bold uppercase tracking-widest mb-4">Budget</label>
            <select
              name="budget"
              value={profile.budget}
              onChange={onChange}
              className="w-full bg-muse-dark border border-muse-gray p-4 focus:outline-none focus:border-muse-white appearance-none text-sm md:text-base"
            >
              {BUDGET_RANGES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <InputGroup 
            label="Preferred Brands (Optional)" 
            name="preferredBrands" 
            value={profile.preferredBrands} 
            onChange={onChange} 
            placeholder="e.g. Target, Zara, Express" 
          />
        </section>

        <button
          onClick={onSubmit}
          className="w-full bg-muse-white text-muse-black py-5 md:py-6 text-xs md:text-sm font-bold tracking-[0.25em] uppercase hover:bg-muse-silver transition-colors mt-8"
        >
          Generate My Look
        </button>
      </div>
    </div>
  );
};

const InputGroup: React.FC<{ label: string; name: string; value: string; onChange: any; placeholder?: string }> = ({ label, name, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs md:text-sm font-bold uppercase tracking-widest mb-4 text-muse-silver">{label}</label>
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full bg-muse-dark border-b border-muse-gray p-2 focus:outline-none focus:border-muse-white transition-colors text-sm md:text-base"
    />
  </div>
);

const LoadingView: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-t-2 border-l-2 border-muse-white rounded-full animate-spin mb-8"></div>
    <p className="text-muse-silver tracking-widest animate-pulse text-xs md:text-base">CURATING YOUR COLLECTION...</p>
  </div>
);

interface ResultViewProps {
  look: StyledLook;
  onSave: (look: StyledLook) => void;
  onEdit: (look: StyledLook) => void;
  onShare: (title: string, text: string) => void;
  isSaved: boolean;
}

const ResultView: React.FC<ResultViewProps> = ({ look, onSave, onEdit, onShare, isSaved }) => {
  return (
    <div className="animate-fade-in pb-20 w-full">
      {/* Header */}
      <header className="text-center mb-16 max-w-3xl mx-auto relative px-2">
        <h1 className="text-3xl md:text-6xl font-serif italic mb-6 break-words leading-tight">{look.title}</h1>
        <p className="text-base md:text-lg text-muse-silver leading-relaxed mb-4">{look.description}</p>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 flex-wrap">
          <div className="inline-block border border-muse-gray px-6 py-2 text-xs tracking-widest uppercase text-muse-silver">
            {look.occasion}
          </div>
          <button 
            onClick={() => !isSaved && onSave(look)}
            disabled={isSaved}
            className={`px-6 py-2 text-xs tracking-widest uppercase border transition-all ${isSaved ? 'bg-muse-white text-muse-black border-muse-white cursor-default' : 'border-muse-white hover:bg-muse-white hover:text-muse-black'}`}
          >
            {isSaved ? 'Saved to Wardrobe' : 'Save Outfit'}
          </button>
          <button 
            onClick={() => onShare(look.title, look.description)}
            className="px-6 py-2 text-xs tracking-widest uppercase border border-muse-white hover:bg-muse-white hover:text-muse-black transition-all"
          >
            Share
          </button>
          <button 
            onClick={() => onEdit(look)}
            className="px-6 py-2 text-xs tracking-widest uppercase border border-muse-white hover:bg-muse-white hover:text-muse-black transition-all"
          >
            Edit Request
          </button>
        </div>
      </header>

      {/* Visual Representation */}
      {look.generatedImage && (
        <div className="mb-20">
           <div className="max-w-md mx-auto aspect-[3/4] bg-muse-dark relative overflow-hidden border border-muse-gray p-2">
            <img 
              src={`data:${look.generatedImageMimeType};base64,${look.generatedImage}`} 
              alt="Generated Look" 
              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
            />
             <div className="absolute bottom-4 right-4 bg-black/50 px-2 py-1 text-[10px] uppercase tracking-widest">
               AI Visualization
             </div>
           </div>
        </div>
      )}

      {/* The Edit (Shopping List) */}
      <div className="space-y-16 max-w-6xl mx-auto">
        {look.sections.map((section, idx) => (
          <div key={idx} className="border-t border-muse-gray pt-8">
            <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8">
              <h3 className="text-2xl font-serif italic">{section.categoryName}</h3>
              <p className="text-sm text-muse-silver max-w-md md:text-right mt-2 md:mt-0">{section.curationReason}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.options.map((item, itemIdx) => (
                <div key={itemIdx} className="group bg-muse-dark p-6 border border-muse-gray/30 hover:border-muse-white transition-all cursor-pointer relative"
                     onClick={() => window.open(item.itemLink, '_blank')}>
                  {item.isAffiliate && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold text-muse-black bg-muse-white px-2 py-0.5 uppercase tracking-wider">
                      Partner
                    </span>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className="pr-2">
                      <h4 className="font-bold text-lg mb-1 group-hover:underline decoration-1 underline-offset-4 break-words">{item.itemName}</h4>
                      <p className="text-sm text-muse-silver uppercase tracking-wider">{item.brand}</p>
                    </div>
                    <span className="text-sm whitespace-nowrap ml-2">{item.priceEstimate}</span>
                  </div>
                  <p className="text-sm text-muse-silver mb-6 line-clamp-2">{item.description}</p>
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-muse-silver group-hover:text-muse-white flex items-center gap-2">
                    Shop Now <span>→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Makeup & Styling */}
      <div className="mt-24 bg-muse-dark p-6 md:p-12 border border-muse-gray">
        <h3 className="text-2xl md:text-3xl font-serif italic mb-8 text-center">The Beauty Edit</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-muse-silver">The Look</h4>
            <p className="font-serif text-lg md:text-xl">{look.makeup.styleName}</p>
          </div>
           <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-muse-silver">Eyes</h4>
            <p className="text-sm md:text-base">{look.makeup.eyes}</p>
          </div>
           <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-muse-silver">Lips</h4>
            <p className="text-sm md:text-base">{look.makeup.lips}</p>
          </div>
           <div>
            <h4 className="text-xs font-bold uppercase tracking-widest mb-4 text-muse-silver">Pro Tip</h4>
            <p className="italic text-muse-silver text-sm md:text-base">"{look.makeup.tips}"</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const SavedLooksView: React.FC<{ looks: StyledLook[], onViewLook: (look: StyledLook) => void, onDeleteLook: (id: string, e: React.MouseEvent) => void, onNewLook: () => void, onShare: (title: string, text: string) => void }> = ({ looks, onViewLook, onDeleteLook, onNewLook, onShare }) => {
  if (looks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center animate-fade-in text-center pb-20 w-full px-4">
        <h2 className="text-2xl md:text-3xl font-serif italic mb-4">Your Wardrobe is Empty</h2>
        <p className="text-muse-silver mb-8">Save your favorite generated looks here.</p>
        <button
          onClick={onNewLook}
          className="bg-muse-white text-muse-black px-8 py-3 text-xs font-bold tracking-[0.2em] hover:bg-muse-silver transition-colors uppercase"
        >
          Create New Look
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slide-up pb-20 w-full">
      <div className="mb-12 border-b border-muse-gray pb-8">
        <h2 className="text-2xl md:text-3xl font-serif italic mb-2">My Wardrobe</h2>
        <p className="text-muse-silver text-sm md:text-base">Your curated collection of saved styles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {looks.map((look) => (
          <div 
            key={look.id} 
            onClick={() => onViewLook(look)}
            className="group bg-muse-dark border border-muse-gray hover:border-muse-white transition-all cursor-pointer flex flex-col"
          >
            {/* Image Preview or Fallback */}
            <div className="aspect-[3/4] bg-muse-black w-full overflow-hidden relative border-b border-muse-gray">
              {look.generatedImage ? (
                <img 
                  src={`data:${look.generatedImageMimeType};base64,${look.generatedImage}`} 
                  alt={look.title}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muse-gray italic font-serif">
                  No Preview
                </div>
              )}
               <button 
                onClick={(e) => onDeleteLook(look.id!, e)}
                className="absolute top-2 right-2 bg-muse-black/80 hover:bg-red-900 text-muse-white p-2 text-xs uppercase tracking-widest border border-muse-gray opacity-0 group-hover:opacity-100 transition-opacity z-20"
              >
                Delete
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(look.title, look.description);
                }}
                className="absolute bottom-2 right-2 bg-muse-white text-muse-black p-2 text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity z-20 font-bold"
              >
                Share
              </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-[10px] text-muse-silver uppercase tracking-widest mb-2">{look.date}</div>
                <h3 className="font-serif text-xl italic mb-2 group-hover:underline decoration-1 underline-offset-4 line-clamp-1">{look.title}</h3>
                <p className="text-sm text-muse-silver line-clamp-2 mb-4">{look.description}</p>
              </div>
              <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muse-silver mt-4">
                <span className="truncate max-w-[50%]">{look.occasion}</span>
                <span className="group-hover:text-muse-white whitespace-nowrap">View Look →</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;