import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Users, ArrowLeft, Search } from "lucide-react";

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
  const [search, setSearch] = useState("");

  const roleLabel = (role: string) => {
    if (role === "player") return lang === "ro" ? "Jucător" : "Player";
    if (role === "scout") return "Scouter";
    return "Agent";
  };

  const filtered = followers.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-display text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {lang === "ro" ? "Urmăritori" : "Followers"} ({followers.length})
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {lang === "ro" ? "Înapoi" : "Back"}
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === "ro" ? "Caută după nume..." : "Search by name..."}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-12">
          {search
            ? (lang === "ro" ? "Niciun rezultat găsit." : "No results found.")
            : (lang === "ro" ? "Nu ai urmăritori încă." : "No followers yet.")}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border hover:bg-accent/50 transition-colors">
              <button onClick={() => onViewProfile(f.follower_id, f.role)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar className="h-10 w-10">
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
