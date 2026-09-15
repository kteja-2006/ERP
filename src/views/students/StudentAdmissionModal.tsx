import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api.ts';
import {
  UserPlus,
  X,
  Sparkles,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Phone,
  Home,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ClassItem {
  id: string;
  name: string;
  class_code: string;
  sections: Array<{ id: string; name: string }>;
}

export const StudentAdmissionModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Form inputs
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('2011-05-15');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherMobile, setFatherMobile] = useState('');
  const [motherName, setMotherName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Live Admission Number Preview (YY + Class ID + Serial)
  const [previewNumber, setPreviewNumber] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Live Sibling Detection
  const [detectedSiblings, setDetectedSiblings] = useState<any[]>([]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingClasses(true);
      setError(null);
      setCreatedResult(null);
      apiRequest<{ classes: ClassItem[] }>('/api/academics/classes')
        .then((res) => {
          setClasses(res.classes || []);
          if (res.classes && res.classes.length > 0) {
            setClassId(res.classes[0].id);
            if (res.classes[0].sections && res.classes[0].sections.length > 0) {
              setSectionId(res.classes[0].sections[0].id);
            }
          }
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingClasses(false));
    }
  }, [isOpen]);

  // Fetch admission number preview when class changes
  useEffect(() => {
    if (classId) {
      setLoadingPreview(true);
      apiRequest<{ previewAdmissionNumber: string }>(`/api/students/next-admission-preview?classId=${classId}`)
        .then((res) => setPreviewNumber(res.previewAdmissionNumber))
        .catch(() => {})
        .finally(() => setLoadingPreview(false));
    }
  }, [classId]);

  // Check guardian mobile for siblings
  const checkMobile = guardianMobile || fatherMobile;
  useEffect(() => {
    if (checkMobile && checkMobile.trim().length >= 10) {
      const timer = setTimeout(() => {
        apiRequest<{ siblings: any[] }>(`/api/students/check-guardian?mobile=${encodeURIComponent(checkMobile.trim())}`)
          .then((res) => setDetectedSiblings(res.siblings || []))
          .catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDetectedSiblings([]);
    }
  }, [checkMobile]);

  const selectedClass = classes.find((c) => c.id === classId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        firstName,
        middleName,
        lastName,
        dateOfBirth,
        gender,
        bloodGroup,
        classId,
        sectionId,
        fatherName,
        fatherMobile,
        motherName,
        guardianName: guardianName || fatherName || motherName,
        guardianMobile: guardianMobile || fatherMobile,
        addressLine1,
        city,
        state,
        postalCode,
        emergencyContact: emergencyContact || guardianMobile || fatherMobile,
      };

      const res = await apiRequest('/api/students/admission', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreatedResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to submit admission');
    } finally {
      setSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (createdResult) {
      const text = `Student User ID: ${createdResult.initialCredentials.userId}\nPassword: ${createdResult.initialCredentials.password}\nAdmission No: ${createdResult.student.admissionNumber}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">New Student Admission</h3>
              <p className="text-xs text-slate-500">
                Enroll student, generate permanent admission number & user credentials
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdResult ? (
          /* Admission Successful Confirmation Screen */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h4 className="text-lg font-bold text-slate-900">Admission Processed Successfully!</h4>
              <p className="text-xs text-slate-500 mt-1">
                Student {createdResult.student.firstName} {createdResult.student.lastName} is now enrolled.
              </p>
            </div>

            {/* Credential summary card */}
            <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-semibold text-slate-700">Permanent Admission Number:</span>
                <span className="font-mono font-bold text-blue-600 text-sm">
                  {createdResult.student.admissionNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Login User ID:</span>
                <span className="font-mono font-semibold text-slate-800 text-xs">
                  {createdResult.initialCredentials.userId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Initial Password:</span>
                <span className="font-mono font-semibold text-slate-800 text-xs">
                  {createdResult.initialCredentials.password}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600">Roll Number:</span>
                <span className="font-semibold text-slate-800 text-xs">
                  Roll #{createdResult.student.rollNumber}
                </span>
              </div>
            </div>

            <div className="flex justify-center space-x-3">
              <button
                type="button"
                onClick={copyCredentials}
                className="inline-flex items-center space-x-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs rounded-lg shadow-2xs cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedResult(null);
                  onClose();
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Admission Entry Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="flex items-center space-x-2 p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Permanent Admission Number Sequence Display (Section 6 & 16) */}
            <div className="p-3.5 bg-blue-50/75 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-900">Permanent Admission Number Preview</span>
                </div>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Pattern: YY ({new Date().getFullYear().toString().slice(-2)}) + Class Code (
                  {selectedClass?.class_code.padStart(3, '0') || '001'}) + 3-digit Serial
                </p>
              </div>
              <div className="px-3 py-1.5 bg-white border border-blue-300 rounded-md font-mono font-bold text-blue-700 text-sm shadow-2xs">
                {loadingPreview ? '...' : previewNumber || 'Generating...'}
              </div>
            </div>

            {/* Sibling Detection Alert */}
            {detectedSiblings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-900">
                <Users className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Existing Sibling Account Detected:</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Found {detectedSiblings.length} student(s) with this guardian mobile:{' '}
                    {detectedSiblings.map((s) => `${s.first_name} ${s.last_name} (${s.class_name})`).join(', ')}.
                    Guardian mobile will automatically enable multi-child login!
                  </p>
                </div>
              </div>
            )}

            {/* Section 1: Academic Enrollment */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                1. Academic Enrollment
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Class *</label>
                  <select
                    required
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      const cls = classes.find((c) => c.id === e.target.value);
                      if (cls && cls.sections.length > 0) {
                        setSectionId(cls.sections[0].id);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Code: {c.class_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Section *</label>
                  <select
                    required
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  >
                    {selectedClass?.sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        Section {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Student Demographic Details */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                2. Student Demographic Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Aryan"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Reddy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Blood Group</label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  >
                    <option value="O+">O+</option>
                    <option value="A+">A+</option>
                    <option value="B+">B+</option>
                    <option value="AB+">AB+</option>
                    <option value="O-">O-</option>
                    <option value="A-">A-</option>
                    <option value="B-">B-</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Guardian & Contact Information */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                3. Guardian & Contact Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Father's Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="e.g. Ramesh Reddy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mother's Name</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="e.g. Lakshmi Reddy"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Guardian Mobile (Login Identifier) *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={guardianMobile || fatherMobile}
                    onChange={(e) => {
                      setGuardianMobile(e.target.value);
                      setFatherMobile(e.target.value);
                    }}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Emergency Contact Number</label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="e.g. 9876543219"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    placeholder="Flat / House No, Street, Landmark"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="e.g. 500081"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingClasses}
                className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{submitting ? 'Enrolling Student...' : 'Confirm Admission'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
