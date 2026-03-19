import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t.auth.passwordResetError, description: t.auth.passwordsMismatch, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: t.auth.passwordResetSuccess, description: t.auth.passwordResetSuccessDesc });
      navigate("/auth?tab=login");
    } catch (error: any) {
      toast({ title: t.auth.passwordResetError, description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pitch via-pitch/95 to-primary/20 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/auth?tab=login" className="inline-flex items-center gap-1 text-primary-foreground/70 hover:text-primary mb-6 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> {t.auth.backToLogin}
        </Link>

        <Card className="bg-card/95 backdrop-blur border-primary/20 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-2xl">🔒</span>
            </div>
            <CardTitle className="font-display text-3xl text-foreground">
              {t.auth.resetPasswordTitle}
            </CardTitle>
            <CardDescription className="font-body">
              {t.auth.resetPasswordDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="font-body">{t.auth.newPassword}</Label>
                <Input id="newPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="font-body">{t.auth.confirmPassword}</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5" disabled={loading}>
                {loading ? t.auth.processing : t.auth.resetPassword}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
