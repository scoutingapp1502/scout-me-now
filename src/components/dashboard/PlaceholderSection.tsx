import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface PlaceholderSectionProps {
  title: string;
}

const PlaceholderSection = ({ title }: PlaceholderSectionProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Card className="bg-card border-border max-w-md w-full">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="h-12 w-12 text-primary mb-4" />
          <h2 className="font-display text-3xl text-foreground mb-2">{title}</h2>
          <p className="text-muted-foreground font-body text-sm">
            {t.dashboard.placeholder.comingSoon}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlaceholderSection;
