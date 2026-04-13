import { useLanguage } from "@/i18n/LanguageContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X, Users } from "lucide-react";

interface Follower {
  id: string;
  follower_id: string;
  name: string;
  photo: string | null;
  role: "player" | "scout" | "agent";
}

interface FollowersListProps {
  followers: Follower[];
  onRemove: (followId: string) => void;
  onViewProfile: (userId: string, role: "player" | "scout" | "agent") => void;
  onClose: () => void;
}

const FollowersList = ({ followers, onRemove, onViewProfile, onClose }: FollowersListProps) => {
  const { lang } = useLanguage();

  const roleLabel = (role: string) => {
    if (role === "player") return lang === "ro" ? "Jucător" : "Player";
    if (role === "scout") return "Scouter";
    return "Agent";
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-display text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {lang === "ro" ? "Urmăritori" : "Followers"} ({followers.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {followers.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">
          {lang === "ro" ? "Nu ai urmăritori încă." : "No followers yet."}
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {followers.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
              <button onClick={() => onViewProfile(f.follower_id, f.role)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar className="h-9 w-9">
                  {f.photo ? <AvatarImage src={f.photo} /> : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {f.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabel(f.role)}</p>
                </div>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(f.id)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                title={lang === "ro" ? "Elimină urmăritor" : "Remove follower"}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FollowersList;
