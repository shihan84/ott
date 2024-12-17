import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import type { User } from '@db/schema';
import { Loader2, UserPlus, Trash2, Key } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const userSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  isAdmin: z.boolean().default(false),
});

export default function UserManagement() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: api.getUsers,
  });

  const { data: streams } = useQuery({
    queryKey: ['/api/streams'],
    queryFn: async () => {
      const servers = await api.getServers();
      const allStreams = await Promise.all(
        servers.map(server => api.getServerStreams(server.id))
      );
      return allStreams.flat();
    },
  });

  const { data: userPermissions } = useQuery({
    queryKey: ['/api/users', selectedUser?.id, 'permissions'],
    queryFn: () => api.getUserPermissions(selectedUser!.id),
    enabled: !!selectedUser,
  });

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      password: '',
      isAdmin: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof userSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Management</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Admin User</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create User
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Stream Permissions</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">User: {selectedUser.username}</h3>
                <div className="space-y-2">
                  <Select
                    onValueChange={(value) => {
                      const streamId = parseInt(value);
                      api.addUserPermission(selectedUser.id, streamId)
                        .then(() => {
                          queryClient.invalidateQueries({ 
                            queryKey: ['/api/users', selectedUser.id, 'permissions'] 
                          });
                          toast({
                            title: "Success",
                            description: "Permission added successfully",
                          });
                        })
                        .catch((error) => {
                          toast({
                            title: "Error",
                            description: error.message,
                            variant: "destructive",
                          });
                        });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a stream" />
                    </SelectTrigger>
                    <SelectContent>
                      {streams?.map((stream) => (
                        <SelectItem key={stream.id} value={stream.id.toString()}>
                          {stream.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Current Permissions</h4>
                  {userPermissions?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No permissions</p>
                  ) : (
                    <div className="space-y-2">
                      {userPermissions?.map((permission) => {
                        const stream = streams?.find(s => s.id === permission.streamId);
                        return (
                          <div key={permission.streamId} className="flex items-center justify-between">
                            <span>{stream?.name}</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                api.removeUserPermission(selectedUser.id, permission.streamId)
                                  .then(() => {
                                    queryClient.invalidateQueries({ 
                                      queryKey: ['/api/users', selectedUser.id, 'permissions'] 
                                    });
                                    toast({
                                      title: "Success",
                                      description: "Permission removed successfully",
                                    });
                                  })
                                  .catch((error) => {
                                    toast({
                                      title: "Error",
                                      description: error.message,
                                      variant: "destructive",
                                    });
                                  });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.isAdmin ? 'Admin' : 'User'}</TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsPermissionDialogOpen(true);
                      }}
                    >
                      <Key className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(user.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
