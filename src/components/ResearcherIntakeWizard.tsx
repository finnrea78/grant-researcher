"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IntakeData, EligibilityConstraints, ProposalIntent } from "@/lib/types";
import { TOTAL_STEPS } from "@/components/ResearcherIntakeWizard.constants";

export interface ResearcherIntakeWizardProps {
  onSubmit: (formData: FormData) => void;
  loading?: boolean;
}



const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function inputClass(autoFilled?: boolean) {
  return `w-full bg-slate-800 border ${autoFilled ? "border-blue-500" : "border-slate-600"} rounded-lg px-4 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400`;
}

function textareaClass(autoFilled?: boolean) {
  return `w-full bg-slate-800 border ${autoFilled ? "border-blue-500" : "border-slate-600"} rounded-lg px-4 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none`;
}

function FieldLabel({ children, autoFilled }: { children: React.ReactNode; autoFilled?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Label className="text-slate-300 text-sm">{children}</Label>
      {autoFilled && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-900 text-blue-300 border-blue-700">
          auto-filled
        </Badge>
      )}
    </div>
  );
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ResearcherIntakeWizard({ onSubmit, loading = false }: ResearcherIntakeWizardProps) {
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState<IntakeData>({});
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastFetchedOrcid = useRef<string | null>(null);

  // Local textarea strings for comma-separated fields
  const [researchThemesText, setResearchThemesText] = useState("");
  const [researchKeywordsText, setResearchKeywordsText] = useState("");
  const [disciplinaryFieldsText, setDisciplinaryFieldsText] = useState("");
  const [geographicFocusText, setGeographicFocusText] = useState("");

  // Proposal intent (step 4) — ephemeral, never stored in Supabase
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalDescription, setProposalDescription] = useState("");
  const [proposalDiscipline, setProposalDiscipline] = useState("");
  const [proposalMethodology, setProposalMethodology] = useState("");

  function mergeIntake(partial: Partial<IntakeData>, fields: string[]) {
    setIntake((prev) => ({ ...prev, ...partial }));
    setAutoFilledFields((prev) => {
      const next = new Set(prev);
      fields.forEach((f) => next.add(f));
      return next;
    });
  }

  async function fetchOrcid(orcid: string) {
    if (!ORCID_RE.test(orcid)) return;
    if (lastFetchedOrcid.current === orcid) return;
    lastFetchedOrcid.current = orcid;
    setOrcidLoading(true);
    try {
      const res = await fetch(`/api/orcid?id=${encodeURIComponent(orcid)}`);
      if (!res.ok) return;
      const data: Partial<IntakeData> = await res.json();
      const filled: string[] = [];

      const partial: Partial<IntakeData> = {};

      if (data.name) { partial.name = data.name; filled.push("name"); }
      if (data.institution) { partial.institution = data.institution; filled.push("institution"); }
      if (data.department) { partial.department = data.department; filled.push("department"); }
      if (data.institution_country) { partial.institution_country = data.institution_country; filled.push("institution_country"); }
      if (data.career_stage) { partial.career_stage = data.career_stage; filled.push("career_stage"); }
      if (data.research_themes?.length) {
        partial.research_themes = data.research_themes;
        setResearchThemesText(data.research_themes.join(", "));
        filled.push("research_themes");
      }
      if (data.research_keywords?.length) {
        partial.research_keywords = data.research_keywords;
        setResearchKeywordsText(data.research_keywords.join(", "));
        filled.push("research_keywords");
      }
      if (data.eligibility) { partial.eligibility = data.eligibility; filled.push("eligibility"); }

      mergeIntake(partial, filled);
    } finally {
      setOrcidLoading(false);
    }
  }

  function handleOrcidChange(value: string) {
    setIntake((prev) => ({
      ...prev,
      identifiers: { ...prev.identifiers, orcid: value },
    }));
    if (ORCID_RE.test(value)) {
      fetchOrcid(value);
    } else {
      lastFetchedOrcid.current = null;
    }
  }

  function toggleArrayItem<T>(arr: T[] | undefined, item: T): T[] {
    if (!arr) return [item];
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setCvFile(dropped);
  }

  function handleSubmit() {
    const proposalIntent: ProposalIntent = {
      project_title: proposalTitle || undefined,
      description: proposalDescription || undefined,
      target_discipline: proposalDiscipline || undefined,
      methodology: proposalMethodology || undefined,
    };
    const hasProposal = Object.values(proposalIntent).some(Boolean);

    const finalIntake: IntakeData = {
      ...intake,
      research_themes: parseCommaSeparated(researchThemesText),
      research_keywords: parseCommaSeparated(researchKeywordsText),
      disciplinary_fields: parseCommaSeparated(disciplinaryFieldsText),
      geographic_focus: parseCommaSeparated(geographicFocusText),
      ...(hasProposal ? { proposal_intent: proposalIntent } : {}),
    };

    const formData = new FormData();
    formData.append("name", finalIntake.name ?? "");
    formData.append("intake", JSON.stringify(finalIntake));
    if (cvFile) formData.append("cv", cvFile);

    onSubmit(formData);
  }

  const canAdvance = step === 2 ? Boolean(intake.name?.trim()) : true;

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl">
      {/* Step counter */}
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs">Step {step} of {TOTAL_STEPS}</span>
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i + 1 < step ? "bg-blue-500" : i + 1 === step ? "bg-blue-400" : "bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex flex-col gap-4">
        {/* Step 1: Identifiers */}
        {step === 1 && (
          <>
            <h2 className="text-slate-100 font-semibold">Identifiers</h2>
            <div>
              <FieldLabel>ORCID</FieldLabel>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0000-0000-0000-0000"
                  value={intake.identifiers?.orcid ?? ""}
                  onChange={(e) => handleOrcidChange(e.target.value)}
                  onBlur={(e) => fetchOrcid(e.target.value)}
                  className={inputClass()}
                />
                {orcidLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 text-xs">
                    Loading…
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-1">
                We'll auto-populate your profile if found
              </p>
            </div>
            <div>
              <FieldLabel>Google Scholar URL</FieldLabel>
              <input
                type="url"
                placeholder="https://scholar.google.com/citations?user=…"
                value={intake.identifiers?.google_scholar_url ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({
                    ...prev,
                    identifiers: { ...prev.identifiers, google_scholar_url: e.target.value },
                  }))
                }
                className={inputClass()}
              />
            </div>
          </>
        )}

        {/* Step 2: Career */}
        {step === 2 && (
          <>
            <h2 className="text-slate-100 font-semibold">Career</h2>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("name")}>
                Name <span className="text-red-400">*</span>
              </FieldLabel>
              <input
                type="text"
                placeholder="Your name"
                value={intake.name ?? ""}
                onChange={(e) => setIntake((prev) => ({ ...prev, name: e.target.value }))}
                className={inputClass(autoFilledFields.has("name"))}
              />
            </div>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("institution")}>Institution</FieldLabel>
              <input
                type="text"
                placeholder="e.g. University of Edinburgh"
                value={intake.institution ?? ""}
                onChange={(e) => setIntake((prev) => ({ ...prev, institution: e.target.value }))}
                className={inputClass(autoFilledFields.has("institution"))}
              />
            </div>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("department")}>Department</FieldLabel>
              <input
                type="text"
                placeholder="e.g. School of Informatics"
                value={intake.department ?? ""}
                onChange={(e) => setIntake((prev) => ({ ...prev, department: e.target.value }))}
                className={inputClass(autoFilledFields.has("department"))}
              />
            </div>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("career_stage")}>Career stage</FieldLabel>
              <select
                value={intake.career_stage ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({
                    ...prev,
                    career_stage: e.target.value as IntakeData["career_stage"],
                  }))
                }
                className={inputClass(autoFilledFields.has("career_stage"))}
              >
                <option value="">Select…</option>
                <option value="phd_student">PhD student</option>
                <option value="postdoc">Postdoc</option>
                <option value="early_career">Early career</option>
                <option value="mid_career">Mid career</option>
                <option value="senior">Senior</option>
              </select>
            </div>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("institution_country")}>
                Institution country
              </FieldLabel>
              <input
                type="text"
                placeholder="e.g. UK"
                value={intake.institution_country ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({ ...prev, institution_country: e.target.value }))
                }
                className={inputClass(autoFilledFields.has("institution_country"))}
              />
            </div>
          </>
        )}

        {/* Step 3: Research */}
        {step === 3 && (
          <>
            <h2 className="text-slate-100 font-semibold">Research</h2>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("research_themes")}>
                Research themes
              </FieldLabel>
              <textarea
                placeholder="Comma-separated, e.g. machine learning, digital humanities"
                value={researchThemesText}
                onChange={(e) => setResearchThemesText(e.target.value)}
                rows={2}
                className={textareaClass(autoFilledFields.has("research_themes"))}
              />
            </div>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("research_keywords")}>
                Research keywords
              </FieldLabel>
              <textarea
                placeholder="Comma-separated keywords"
                value={researchKeywordsText}
                onChange={(e) => setResearchKeywordsText(e.target.value)}
                rows={2}
                className={textareaClass(autoFilledFields.has("research_keywords"))}
              />
            </div>
            <div>
              <FieldLabel>Disciplinary fields</FieldLabel>
              <textarea
                placeholder="Comma-separated, e.g. Computer Science, Linguistics"
                value={disciplinaryFieldsText}
                onChange={(e) => setDisciplinaryFieldsText(e.target.value)}
                rows={2}
                className={textareaClass()}
              />
            </div>
            <div>
              <FieldLabel>Geographic focus</FieldLabel>
              <textarea
                placeholder="Comma-separated regions, e.g. UK, Europe, Sub-Saharan Africa"
                value={geographicFocusText}
                onChange={(e) => setGeographicFocusText(e.target.value)}
                rows={2}
                className={textareaClass()}
              />
            </div>
          </>
        )}

        {/* Step 4: Proposal */}
        {step === 4 && (
          <>
            <h2 className="text-slate-100 font-semibold">Project Proposal</h2>
            <p className="text-slate-500 text-sm">
              Describe the project you have in mind. This helps us match you to the most relevant funding opportunities — and is never stored after matching.
            </p>
            <div>
              <FieldLabel>Project title</FieldLabel>
              <input
                type="text"
                placeholder="A working title for your proposed project"
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div>
              <FieldLabel>Project description</FieldLabel>
              <textarea
                placeholder="What is the research question or problem? What makes this work significant? Who does it benefit and how?"
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
                rows={5}
                className={textareaClass()}
              />
            </div>
            <div>
              <FieldLabel>Primary discipline</FieldLabel>
              <input
                type="text"
                placeholder="e.g. Computational Biology, Urban Planning, Medieval History"
                value={proposalDiscipline}
                onChange={(e) => setProposalDiscipline(e.target.value)}
                className={inputClass()}
              />
            </div>
            <div>
              <FieldLabel>Methodology</FieldLabel>
              <textarea
                placeholder="How will you approach this? What methods, tools, or techniques will you use?"
                value={proposalMethodology}
                onChange={(e) => setProposalMethodology(e.target.value)}
                rows={3}
                className={textareaClass()}
              />
            </div>
          </>
        )}

        {/* Step 5: Eligibility */}
        {step === 5 && (
          <>
            <h2 className="text-slate-100 font-semibold">Eligibility</h2>
            <div>
              <FieldLabel autoFilled={autoFilledFields.has("eligibility")}>
                Employment type
              </FieldLabel>
              <select
                value={intake.eligibility?.employment_type ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({
                    ...prev,
                    eligibility: {
                      ...prev.eligibility,
                      employment_type: e.target.value as EligibilityConstraints["employment_type"],
                    },
                  }))
                }
                className={inputClass(autoFilledFields.has("eligibility"))}
              >
                <option value="">Select…</option>
                <option value="permanent">Permanent</option>
                <option value="fixed_term">Fixed term</option>
                <option value="independent">Independent</option>
                <option value="postdoc">Postdoc</option>
                <option value="phd_student">PhD student</option>
              </select>
            </div>
            <div>
              <FieldLabel>Year of PhD completion</FieldLabel>
              <input
                type="number"
                placeholder="e.g. 2020"
                value={intake.eligibility?.phd_year ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({
                    ...prev,
                    eligibility: {
                      ...prev.eligibility,
                      phd_year: e.target.value ? Number(e.target.value) : undefined,
                    },
                  }))
                }
                className={inputClass()}
              />
            </div>
            <div>
              <FieldLabel>Nationality</FieldLabel>
              <input
                type="text"
                placeholder="e.g. British, Irish (comma-separated)"
                value={intake.eligibility?.nationality?.join(", ") ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({
                    ...prev,
                    eligibility: {
                      ...prev.eligibility,
                      nationality: parseCommaSeparated(e.target.value),
                    },
                  }))
                }
                className={inputClass()}
              />
            </div>
            <div>
              <FieldLabel>Institution type</FieldLabel>
              <select
                value={intake.eligibility?.institution_type ?? ""}
                onChange={(e) =>
                  setIntake((prev) => ({
                    ...prev,
                    eligibility: {
                      ...prev.eligibility,
                      institution_type: e.target.value as EligibilityConstraints["institution_type"],
                    },
                  }))
                }
                className={inputClass()}
              >
                <option value="">Select…</option>
                <option value="university">University</option>
                <option value="research_institute">Research institute</option>
                <option value="hospital">Hospital</option>
                <option value="ngo">NGO</option>
                <option value="industry">Industry</option>
              </select>
            </div>
          </>
        )}

        {/* Step 6: CV Upload */}
        {step === 6 && (
          <>
            <h2 className="text-slate-100 font-semibold">CV Upload</h2>
            <p className="text-slate-500 text-sm">
              Optional — upload your CV to improve grant matching accuracy.
            </p>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging
                  ? "border-blue-400 bg-blue-950"
                  : "border-slate-600 hover:border-slate-400"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.pdf,.txt,.docx"
                className="hidden"
                onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
              />
              <div className="text-3xl mb-2">📄</div>
              {cvFile ? (
                <p className="text-slate-300 text-sm">{cvFile.name}</p>
              ) : (
                <>
                  <p className="text-slate-400 text-sm">Drop your CV here or click to browse</p>
                  <p className="text-slate-600 text-xs mt-1">.md, .pdf, .docx, or .txt</p>
                </>
              )}
            </div>
            {cvFile && (
              <button
                type="button"
                onClick={() => setCvFile(null)}
                className="text-slate-500 text-xs hover:text-slate-300 self-start"
              >
                Remove file
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="border-slate-600 text-slate-300 hover:text-slate-100 bg-transparent hover:bg-slate-800"
        >
          Previous
        </Button>

        <div className="flex items-center gap-3">
          {step < TOTAL_STEPS && step !== 2 && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="text-slate-500 text-sm hover:text-slate-300"
            >
              Skip
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              {loading ? "Starting…" : "Submit →"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
