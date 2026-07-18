"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Building2, Camera, Check, FileCheck2, Gift, ImageUp, Languages, LoaderCircle, MapPin, Save, ShieldCheck } from "lucide-react";
import { saveFoundingPartnerOnboarding, type OnboardingState } from "@/app/founders/actions";
import { FOUNDING_VERTICAL_CATALOG } from "@/src/domain/founding-fifty/catalog";
import { PROPERTY_MANAGER_PERK_TYPES, propertyManagerPerkSuggestions } from "@/src/domain/vendor-memberships/property-manager-perk";

const initialState: OnboardingState = { status: "idle" };
const input = "mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const textarea = `${input} min-h-28 py-3`;

type Application = {
  status: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  website: string | null;
  business_description: string | null;
  years_in_business: number | null;
  primary_service_category: string | null;
  additional_service_categories: string[] | null;
  services_offered: string[] | null;
  service_area_cities: string[] | null;
  service_radius_miles: number | null;
  customer_type: string | null;
  emergency_service_available: boolean;
  operating_hours: string | null;
  license_applicable: boolean;
  license_number: string | null;
  insurance_status: string | null;
  preferred_contact_method: string | null;
  google_business_profile_url: string | null;
  facebook_page_url: string | null;
  other_social_links: string[] | null;
  profile_headline: string | null;
  company_bio: string | null;
  logo_url: string | null;
  featured_image_url: string | null;
  offers_free_estimates: boolean;
  offers_financing: boolean;
  languages_spoken: string[] | null;
  property_manager_perk_enabled: boolean;
  property_manager_perk_title: string | null;
  property_manager_perk_description: string | null;
  property_manager_perk_type: string | null;
  property_manager_perk_terms: string | null;
  property_manager_perk_expiration_date: string | null;
  accuracy_confirmed: boolean;
  public_display_consent: boolean;
  terms_privacy_accepted: boolean;
  last_saved_at: string | null;
};

function FieldError({ state, name }: { state: OnboardingState; name: string }) {
  const message = state.fieldErrors?.[name];
  return message ? <span role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-700"><AlertCircle aria-hidden="true" className="size-3.5" />{message}</span> : null;
}

function Section({ id, number, title, description, icon: Icon, children }: { id: string; number: string; title: string; description: string; icon: typeof Building2; children: React.ReactNode }) {
  return <fieldset id={id} className="scroll-mt-8 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><legend className="sr-only">{title}</legend><div className="mb-7 flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50"><Icon aria-hidden="true" className="size-5 text-emerald-700" /></span><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">{number}</p><h2 className="mt-1 text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></div></div>{children}</fieldset>;
}

const progressNames = ["businessName","contactName","phone","businessDescription","yearsInBusiness","primaryServiceCategory","servicesOffered","serviceAreaCities","serviceRadiusMiles","customerType","operatingHours","insuranceStatus","preferredContactMethod","profileHeadline","companyBio","languagesSpoken"];

function savedProgress(application: Application) {
  const complete = [Boolean(application.business_name), Boolean(application.contact_name), Boolean(application.phone), Boolean(application.business_description), application.years_in_business !== null, Boolean(application.primary_service_category), Boolean(application.services_offered?.length), Boolean(application.service_area_cities?.length), application.service_radius_miles !== null, Boolean(application.customer_type), Boolean(application.operating_hours), Boolean(application.insurance_status), Boolean(application.preferred_contact_method), Boolean(application.profile_headline), Boolean(application.company_bio), Boolean(application.languages_spoken?.length)].filter(Boolean).length;
  const consents = [application.accuracy_confirmed, application.public_display_consent, application.terms_privacy_accepted].filter(Boolean).length;
  return Math.round(((complete + consents) / (progressNames.length + 3)) * 100);
}

export function FoundingPartnerOnboardingForm({ application, customerEmail, customerName }: { application: Application; customerEmail: string; customerName: string | null }) {
  const [state, action, pending] = useActionState(saveFoundingPartnerOnboarding, initialState);
  const [licenseApplicable, setLicenseApplicable] = useState(application.license_applicable);
  const [progress, setProgress] = useState(() => savedProgress(application));
  const [category, setCategory] = useState(application.primary_service_category ?? "");
  const [perkEnabled, setPerkEnabled] = useState(application.property_manager_perk_enabled);
  const [perkTitle, setPerkTitle] = useState(application.property_manager_perk_title ?? "");
  const [perkDescription, setPerkDescription] = useState(application.property_manager_perk_description ?? "");
  const [perkType, setPerkType] = useState(application.property_manager_perk_type ?? "custom");
  const [perkTerms, setPerkTerms] = useState(application.property_manager_perk_terms ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  function updateProgress() {
    if (!formRef.current) return;
    const data = new FormData(formRef.current);
    const complete = progressNames.filter(name => String(data.get(name) ?? "").trim().length > 0).length;
    const consents = ["accuracyConfirmed","publicDisplayConsent","termsPrivacyAccepted"].filter(name => data.get(name) === "on").length;
    setProgress(Math.round(((complete + consents) / (progressNames.length + 3)) * 100));
  }

  return <form ref={formRef} action={action} encType="multipart/form-data" onInput={updateProgress} onChange={updateProgress} className="space-y-5">
    <div className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">Profile completion</p><p aria-live="polite" className="mt-1 text-sm font-bold">{progress}% of required fields completed</p></div>{application.last_saved_at ? <p className="hidden text-xs text-slate-400 sm:block">Last saved {new Date(application.last_saved_at).toLocaleString()}</p> : null}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} /></div></div>

    <Section id="business" number="Section 1 of 6" title="Business information" description="The core contact and company details attached to the paid application." icon={Building2}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Legal or public business name <span className="text-rose-600">*</span><input className={input} name="businessName" minLength={2} maxLength={160} defaultValue={application.business_name ?? customerName ?? ""} autoComplete="organization" /><FieldError state={state} name="businessName" /></label>
        <label className="text-sm font-semibold text-slate-700">Contact name <span className="text-rose-600">*</span><input className={input} name="contactName" minLength={2} maxLength={160} defaultValue={application.contact_name ?? ""} autoComplete="name" /><FieldError state={state} name="contactName" /></label>
        <label className="text-sm font-semibold text-slate-700">Email <span className="mt-1.5 flex min-h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base font-normal text-slate-500">{customerEmail}</span><span className="mt-1.5 block text-xs font-normal text-slate-400">Verified through the paid checkout.</span></label>
        <label className="text-sm font-semibold text-slate-700">Phone <span className="text-rose-600">*</span><input className={input} name="phone" type="tel" maxLength={40} defaultValue={application.phone ?? ""} autoComplete="tel" /><FieldError state={state} name="phone" /></label>
        <label className="text-sm font-semibold text-slate-700">Website <span className="font-normal text-slate-400">(optional)</span><input className={input} name="website" type="url" placeholder="https://example.com" defaultValue={application.website ?? ""} autoComplete="url" /><FieldError state={state} name="website" /></label>
        <label className="text-sm font-semibold text-slate-700">Years in business <span className="text-rose-600">*</span><input className={input} name="yearsInBusiness" type="number" min="0" max="250" inputMode="numeric" defaultValue={application.years_in_business ?? ""} /><FieldError state={state} name="yearsInBusiness" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Business description <span className="text-rose-600">*</span><textarea className={textarea} name="businessDescription" minLength={20} maxLength={1200} defaultValue={application.business_description ?? ""} placeholder="Summarize what your business does, its experience, and the customers it serves." /><FieldError state={state} name="businessDescription" /></label>
      </div>
    </Section>

    <Section id="services" number="Section 2 of 6" title="Services and coverage" description="Help buyers understand what you do, where you work, and when you are available." icon={MapPin}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Primary service category <span className="text-rose-600">*</span><select className={input} name="primaryServiceCategory" value={category} onChange={event=>setCategory(event.target.value)}><option value="">Select a category</option>{FOUNDING_VERTICAL_CATALOG.map(item=><option key={item} value={item}>{item}</option>)}</select><FieldError state={state} name="primaryServiceCategory" /></label>
        <label className="text-sm font-semibold text-slate-700">Service radius <span className="text-rose-600">*</span><span className="relative block"><input className={`${input} pr-16`} name="serviceRadiusMiles" type="number" min="0" max="500" inputMode="numeric" defaultValue={application.service_radius_miles ?? ""} /><span className="pointer-events-none absolute right-3 top-5 text-xs text-slate-400">miles</span></span><FieldError state={state} name="serviceRadiusMiles" /></label>
        <div className="sm:col-span-2"><p className="text-sm font-semibold text-slate-700">Additional service categories <span className="font-normal text-slate-400">(optional)</span></p><div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">{FOUNDING_VERTICAL_CATALOG.map(category=><label key={category} className="flex items-start gap-2 rounded-lg p-2 text-xs leading-5 hover:bg-slate-50"><input type="checkbox" name="additionalServiceCategories" value={category} defaultChecked={application.additional_service_categories?.includes(category)} className="mt-0.5 size-4 shrink-0 accent-emerald-700" />{category}</label>)}</div><FieldError state={state} name="additionalServiceCategories" /></div>
        <label className="text-sm font-semibold text-slate-700">Services offered <span className="text-rose-600">*</span><textarea className={textarea} name="servicesOffered" defaultValue={application.services_offered?.join("\n") ?? ""} placeholder={"Water heater repair\nDrain cleaning\nFixture installation"} /><span className="mt-1.5 block text-xs font-normal text-slate-400">One service per line.</span><FieldError state={state} name="servicesOffered" /></label>
        <label className="text-sm font-semibold text-slate-700">Service area cities <span className="text-rose-600">*</span><textarea className={textarea} name="serviceAreaCities" defaultValue={application.service_area_cities?.join("\n") ?? ""} placeholder={"Dallas, TX\nPlano, TX\nFrisco, TX"} /><span className="mt-1.5 block text-xs font-normal text-slate-400">One city and state per line.</span><FieldError state={state} name="serviceAreaCities" /></label>
        <div><p className="text-sm font-semibold text-slate-700">Customer type <span className="text-rose-600">*</span></p><div className="mt-2 grid grid-cols-3 gap-2">{[["residential","Residential"],["commercial","Commercial"],["both","Both"]].map(([value,label])=><label key={value} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-2 text-center text-xs font-bold has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50"><input type="radio" name="customerType" value={value} defaultChecked={application.customer_type===value} className="sr-only" />{label}</label>)}</div><FieldError state={state} name="customerType" /></div>
        <label className="text-sm font-semibold text-slate-700">Typical operating hours <span className="text-rose-600">*</span><input className={input} name="operatingHours" maxLength={600} defaultValue={application.operating_hours ?? ""} placeholder="Mon–Fri, 7:00 AM–6:00 PM" /><FieldError state={state} name="operatingHours" /></label>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" name="emergencyServiceAvailable" defaultChecked={application.emergency_service_available} className="mt-0.5 size-4 shrink-0 accent-emerald-700" /><span>Emergency or after-hours service is available<span className="mt-1 block text-xs font-normal text-slate-400">Only select this if customers can reliably request urgent service.</span></span></label>
      </div>
    </Section>

    <Section id="verification" number="Section 3 of 6" title="Business verification" description="Licensing is requested only when it applies to your trade or jurisdiction." icon={FileCheck2}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 sm:col-span-2"><input type="checkbox" name="licenseApplicable" checked={licenseApplicable} onChange={event=>setLicenseApplicable(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-emerald-700" /><span>A trade or professional license applies to this business<span className="mt-1 block text-xs font-normal text-slate-400">Leave unchecked for categories or locations where no license applies.</span></span></label>
        {licenseApplicable ? <label className="text-sm font-semibold text-slate-700">License number <span className="text-rose-600">*</span><input className={input} name="licenseNumber" maxLength={120} defaultValue={application.license_number ?? ""} /><FieldError state={state} name="licenseNumber" /></label> : <input type="hidden" name="licenseNumber" value="" />}
        <label className="text-sm font-semibold text-slate-700">Insurance status <span className="text-rose-600">*</span><select className={input} name="insuranceStatus" defaultValue={application.insurance_status ?? ""}><option value="">Select status</option><option value="insured">Currently insured</option><option value="pending">Coverage pending</option><option value="not_insured">Not currently insured</option><option value="not_applicable">Not applicable</option></select><FieldError state={state} name="insuranceStatus" /></label>
        <label className="text-sm font-semibold text-slate-700">Preferred contact method <span className="text-rose-600">*</span><select className={input} name="preferredContactMethod" defaultValue={application.preferred_contact_method ?? ""}><option value="">Select method</option><option value="email">Email</option><option value="phone">Phone call</option><option value="text">Text message</option></select><FieldError state={state} name="preferredContactMethod" /></label>
        <label className="text-sm font-semibold text-slate-700">Google Business Profile URL <span className="font-normal text-slate-400">(optional)</span><input className={input} name="googleBusinessProfileUrl" type="url" defaultValue={application.google_business_profile_url ?? ""} placeholder="https://..." /><FieldError state={state} name="googleBusinessProfileUrl" /></label>
        <label className="text-sm font-semibold text-slate-700">Facebook page URL <span className="font-normal text-slate-400">(optional)</span><input className={input} name="facebookPageUrl" type="url" defaultValue={application.facebook_page_url ?? ""} placeholder="https://facebook.com/..." /><FieldError state={state} name="facebookPageUrl" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Other social links <span className="font-normal text-slate-400">(optional)</span><textarea className={textarea} name="otherSocialLinks" defaultValue={application.other_social_links?.join("\n") ?? ""} placeholder={"https://instagram.com/...\nhttps://linkedin.com/company/..."} /><span className="mt-1.5 block text-xs font-normal text-slate-400">One complete URL per line.</span><FieldError state={state} name="otherSocialLinks" /></label>
      </div>
    </Section>

    <Section id="marketplace" number="Section 4 of 6" title="Marketplace profile" description="This content becomes public only after approval and according to your display consent." icon={Camera}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Short headline <span className="text-rose-600">*</span><input className={input} name="profileHeadline" minLength={5} maxLength={120} defaultValue={application.profile_headline ?? ""} placeholder="Reliable HVAC service for North Dallas homes and businesses" /><FieldError state={state} name="profileHeadline" /></label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Detailed company bio <span className="text-rose-600">*</span><textarea className={`${textarea} min-h-40`} name="companyBio" minLength={40} maxLength={4000} defaultValue={application.company_bio ?? ""} placeholder="Tell potential customers what sets your team apart, the work you specialize in, and how you approach service." /><FieldError state={state} name="companyBio" /></label>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><ImageUp aria-hidden="true" className="size-4 text-emerald-700" />Business logo</p><label className="mt-3 block text-xs font-semibold text-slate-600">Logo URL <input className={input} name="logoUrl" type="url" defaultValue={application.logo_url ?? ""} placeholder="https://..." /></label><label className="mt-3 block text-xs font-semibold text-slate-600">Or upload a file<input className="mt-2 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:font-bold file:text-white" name="logoUpload" type="file" accept="image/jpeg,image/png,image/webp" /></label><p className="mt-2 text-xs text-slate-400">JPG, PNG, or WebP up to 5 MB.</p><FieldError state={state} name="logoUrl" /></div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Camera aria-hidden="true" className="size-4 text-emerald-700" />Featured business photo</p><label className="mt-3 block text-xs font-semibold text-slate-600">Image URL <input className={input} name="featuredImageUrl" type="url" defaultValue={application.featured_image_url ?? ""} placeholder="https://..." /></label><label className="mt-3 block text-xs font-semibold text-slate-600">Or upload a file<input className="mt-2 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:font-bold file:text-white" name="featuredImageUpload" type="file" accept="image/jpeg,image/png,image/webp" /></label><p className="mt-2 text-xs text-slate-400">Use a clear team, vehicle, storefront, or completed-work photo.</p><FieldError state={state} name="featuredImageUrl" /></div>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" name="offersFreeEstimates" defaultChecked={application.offers_free_estimates} className="mt-0.5 size-4 shrink-0 accent-emerald-700" />Offers free estimates</label>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700"><input type="checkbox" name="offersFinancing" defaultChecked={application.offers_financing} className="mt-0.5 size-4 shrink-0 accent-emerald-700" />Offers financing options</label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2"><span className="flex items-center gap-2"><Languages aria-hidden="true" className="size-4 text-emerald-700" />Languages spoken <span className="text-rose-600">*</span></span><input className={input} name="languagesSpoken" defaultValue={application.languages_spoken?.join(", ") ?? ""} placeholder="English, Spanish" /><span className="mt-1.5 block text-xs font-normal text-slate-400">Separate languages with commas.</span><FieldError state={state} name="languagesSpoken" /></label>
      </div>
    </Section>

    <Section id="property-manager-perk" number="Section 5 of 6" title="Property Manager Perk" description="Feature one clear offer or service promise for property managers. You can change or disable it later from your vendor dashboard." icon={Gift}>
      <div className="space-y-5">
        <label className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-950"><input type="checkbox" name="propertyManagerPerkEnabled" checked={perkEnabled} onChange={event=>setPerkEnabled(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-emerald-700" /><span>Display this offer after my listing is approved<span className="mt-1 block text-xs font-normal text-emerald-800/70">Available to eligible paid memberships. Empty or expired offers are never displayed.</span></span></label>
        <div><p className="text-sm font-semibold text-slate-700">Suggestions for {category || "your category"}</p><div className="mt-2 flex flex-wrap gap-2">{propertyManagerPerkSuggestions(category).map(suggestion=><button key={suggestion.title} type="button" onClick={()=>{setPerkTitle(suggestion.title);setPerkType(suggestion.type);setPerkEnabled(true);}} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50">{suggestion.title}</button>)}</div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Perk title<input className={input} name="propertyManagerPerkTitle" value={perkTitle} onChange={event=>setPerkTitle(event.target.value)} minLength={perkEnabled ? 3 : undefined} maxLength={80} placeholder="Priority 24–48-hour scheduling" /><FieldError state={state} name="propertyManagerPerk.title" /></label>
          <label className="text-sm font-semibold text-slate-700">Perk category<select className={input} name="propertyManagerPerkType" value={perkType} onChange={event=>setPerkType(event.target.value)}>{PROPERTY_MANAGER_PERK_TYPES.map(type=><option key={type} value={type}>{type.replaceAll("_", " ").replace(/\b\w/g, letter=>letter.toUpperCase())}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Description<textarea className={textarea} name="propertyManagerPerkDescription" value={perkDescription} onChange={event=>setPerkDescription(event.target.value)} minLength={perkEnabled ? 10 : undefined} maxLength={280} placeholder="Explain exactly what property managers receive and when it applies." /><FieldError state={state} name="propertyManagerPerk.description" /></label>
          <label className="text-sm font-semibold text-slate-700">Terms <span className="font-normal text-slate-400">(optional)</span><textarea className={textarea} name="propertyManagerPerkTerms" maxLength={500} value={perkTerms} onChange={event=>setPerkTerms(event.target.value)} placeholder="For example: Valid for new service requests; parts excluded." /></label>
          <label className="text-sm font-semibold text-slate-700">Expiration date <span className="font-normal text-slate-400">(optional)</span><input className={input} name="propertyManagerPerkExpirationDate" type="date" defaultValue={application.property_manager_perk_expiration_date ?? ""} /></label>
        </div>
        <div aria-label="Property Manager Perk preview" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-700">Property Manager Perk · Preview</p><h3 className="mt-2 text-lg font-bold text-amber-950">{perkTitle || "Your offer title"}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-amber-900/75">{perkDescription || "Your clear offer description will appear here."}</p>{perkTerms ? <p className="mt-3 border-t border-amber-200 pt-3 text-xs text-amber-900/65"><strong>Terms:</strong> {perkTerms}</p> : null}</div>
      </div>
    </Section>

    <Section id="consent" number="Section 6 of 6" title="Review and consent" description="Drafts can be saved without these confirmations. All three are required for final submission." icon={ShieldCheck}>
      <div className="space-y-3">
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" name="accuracyConfirmed" defaultChecked={application.accuracy_confirmed} className="mt-1 size-4 shrink-0 accent-emerald-700" /><span>I confirm that the submitted information is accurate and that I am authorized to represent this business. <span className="text-rose-600">*</span><FieldError state={state} name="accuracyConfirmed" /></span></label>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" name="publicDisplayConsent" defaultChecked={application.public_display_consent} className="mt-1 size-4 shrink-0 accent-emerald-700" /><span>I give Optimize Local Connect permission to display approved profile information publicly in the marketplace. <span className="text-rose-600">*</span><FieldError state={state} name="publicDisplayConsent" /></span></label>
        <label className="flex gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-700"><input type="checkbox" name="termsPrivacyAccepted" defaultChecked={application.terms_privacy_accepted} className="mt-1 size-4 shrink-0 accent-emerald-700" /><span>I accept the Optimize Local Connect terms and privacy policy applicable to this Founding Partner application. <span className="text-rose-600">*</span><FieldError state={state} name="termsPrivacyAccepted" /></span></label>
      </div>
    </Section>

    {state.message ? <p role="status" className={`flex gap-2 rounded-xl p-4 text-sm font-semibold ${state.status === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{state.status === "success" ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}{state.message}</p> : null}
    <div className="flex flex-col-reverse gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><button type="submit" name="intent" value="save" disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{pending ? <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" /> : <Save aria-hidden="true" className="mr-2 size-4" />}Save draft</button><button type="submit" name="intent" value="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">Submit for review <ArrowRight aria-hidden="true" className="ml-2 size-4" /></button></div>
  </form>;
}
