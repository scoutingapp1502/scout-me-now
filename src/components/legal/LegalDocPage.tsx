import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SportriseWordmark from "@/components/SportriseWordmark";
import LegalDocBody from "./LegalDocBody";

interface LegalSection {
  title: string;
  body: string;
}

interface LegalDocPageProps {
  eyebrow: string;
  title: string;
  lastUpdated: string;
  tocLabel: string;
  sections: LegalSection[];
  backLabel: string;
}

const LegalDocPage = ({ eyebrow, title, lastUpdated, tocLabel, sections, backLabel }: LegalDocPageProps) => {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <SportriseWordmark className="text-lg" />
          </Link>
          <Link to="/auth?tab=register" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 font-body transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </div>
      </div>

      <LegalDocBody eyebrow={eyebrow} title={title} lastUpdated={lastUpdated} tocLabel={tocLabel} sections={sections} />
    </div>
  );
};

export default LegalDocPage;
