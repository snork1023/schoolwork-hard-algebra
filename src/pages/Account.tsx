import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const Account = () => {
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupPin, setBackupPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }
      
      setUserId(user.id);
      setUserEmail(user.email || "");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, backup_pin")
        .eq("id", user.id)
        .single();
      
      if (profile) {
        setUsername(profile.username || "");
        setBackupPin(profile.backup_pin || "");
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleUpdateUsername = async () => {
    if (!userId || !username.trim()) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: username.trim() })
      .eq("id", userId);
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Username updated successfully",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Password updated successfully",
      });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleUpdateBackupPin = async () => {
    if (!userId || !backupPin.trim()) return;
    
    if (backupPin.length < 4) {
      toast({
        title: "Error",
        description: "Backup PIN must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ backup_pin: backupPin.trim() })
      .eq("id", userId);
    
    setLoading(false);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to update backup PIN",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Backup PIN updated successfully",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    
    setLoading(true);
    
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    
    if (profileError) {
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    
    await supabase.auth.signOut();
    setLoading(false);
    
    toast({
      title: "Account Deleted",
      description: "Your account has been permanently deleted",
    });
    
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 glow-text">Account</h1>
          <p className="text-muted-foreground mb-8">
            Manage your account settings
          </p>

          <div className="space-y-6">
            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={userEmail} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Nickname</Label>
                  <div className="flex gap-2">
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your nickname"
                    />
                    <Button onClick={handleUpdateUsername} disabled={loading}>
                      Update
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                  Update your password and backup PIN
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button onClick={handleUpdatePassword} disabled={loading}>
                    Update Password
                  </Button>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="backup-pin">Backup PIN</Label>
                    <p className="text-sm text-muted-foreground">
                      Use this PIN to recover your account if you forget your password
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="backup-pin"
                        type="text"
                        value={backupPin}
                        onChange={(e) => setBackupPin(e.target.value)}
                        placeholder="Enter backup PIN (min 4 characters)"
                      />
                      <Button onClick={handleUpdateBackupPin} disabled={loading}>
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-lg hover-glow">
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>
                  Sign out or delete your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  onClick={handleSignOut}
                  className="w-full"
                >
                  Sign Out
                </Button>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your
                        account and remove all your data from our servers.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAccount} disabled={loading}>
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Account;
