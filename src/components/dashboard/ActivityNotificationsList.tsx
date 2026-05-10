import { useLanguage } from "@/i18n/LanguageContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Newspaper, ThumbsUp } from "lucide-react";
import type { ActivityNotificationItem } from "@/hooks/useActivityNotifications";

interface ActivityNotificationsListProps {
  notifications: ActivityNotificationItem[];
  onViewPost: (postId: string) => void;
}

const ActivityNotificationsList = ({ notifications, onViewPost }: ActivityNotificationsListProps) => {
  const { lang } = useLanguage();

  const getMessage = (n: ActivityNotificationItem) => {
    switch (n.type) {
      case "new_post":
        return lang === "ro" ? "a publicat o postare nouă" : "published a new post";
      case "comment_like":
        return lang === "ro" ? "a apreciat comentariul tău" : "liked your comment";
      case "post_like":
        return lang === "ro" ? "a apreciat postarea ta" : "liked your post";
      case "post_comment":
        return lang === "ro" ? "a comentat la postarea ta" : "commented on your post";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_post": return <Newspaper className="h-3.5 w-3.5 text-primary" />;
      case "comment_like": return <ThumbsUp className="h-3.5 w-3.5 text-amber-500" />;
      case "post_like": return <Heart className="h-3.5 w-3.5 text-red-500" />;
      case "post_comment": return <MessageCircle className="h-3.5 w-3.5 text-blue-500" />;
      default: return null;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === "ro" ? "acum" : "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {lang === "ro" ? "Nicio notificare nouă." : "No new notifications."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map(n => (
        <button
          key={n.id}
          onClick={() => onViewPost(n.post_id)}
          className="w-full flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary/30 hover:bg-primary/10 transition-all text-left"
        >
          <Avatar className="h-9 w-9 shrink-0">
            {n.actor_photo ? <AvatarImage src={n.actor_photo} /> : null}
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {n.actor_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-semibold">{n.actor_name}</span>{" "}
              <span className="text-foreground/80">{getMessage(n)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {timeAgo(n.created_at)}
            </p>
          </div>
          <div className="shrink-0">{getIcon(n.type)}</div>
        </button>
      ))}
    </div>
  );
};

export default ActivityNotificationsList;
