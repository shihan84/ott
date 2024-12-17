import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '@/lib/api';
import type { Server } from '@db/schema';
import type { StreamWithStats } from '@/types';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ServerIcon, Trash2, Activity, Users, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

const serverSchema = z.object({
  name: z.string().min(1, "Server name is required"),
  url: z.string().url("Must be a valid URL").refine(url => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, "Must be an HTTP/HTTPS URL"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function ServerManagement() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TooltipProvider>
      <ServerManagementContent isOpen={isOpen} setIsOpen={setIsOpen} />
    </TooltipProvider>
  );
}

interface ServerManagementContentProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

function ServerManagementContent({ isOpen, setIsOpen }: ServerManagementContentProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: servers, isLoading, error } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
    queryFn: api.getServers,
  });

  // Show error toast if server fetch fails
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch servers",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const form = useForm<z.infer<typeof serverSchema>>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      name: '',
      url: '',
      username: '',
      password: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: api.createServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      setIsOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Server added successfully",
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
    mutationFn: api.deleteServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      toast({
        title: "Success",
        description: "Server removed successfully",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: api.testServerConnection,
    onSuccess: (data, serverId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      toast({
        title: "Success",
        description: `Successfully connected to ${data.name}`,
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

  const testConnection = (serverId: number) => {
    testConnectionMutation.mutate(serverId);
  };

  const onSubmit = (data: z.infer<typeof serverSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Server Management</CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <ServerIcon className="w-4 h-4 mr-2" />
              Add Server
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Media Server</DialogTitle>
              <DialogDescription id="add-server-description">
                Add a new Flussonic Media Server by providing its connection details.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Main Server" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://streaming.example.com" />
                      </FormControl>
                      <FormDescription>
                        The base URL of your Flussonic Media Server
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormDescription>
                        Your Flussonic server username
                      </FormDescription>
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
                        <Input {...field} type="password" />
                      </FormControl>
                      <FormDescription>
                        Your Flussonic server password
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Server
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
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added On</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers?.map((server) => (
              <TableRow key={server.id}>
                <TableCell>{server.name}</TableCell>
                <TableCell>{server.url}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant={server.status === 'online' ? 'default' : 'destructive'}>
                      {server.status}
                    </Badge>
                    {server.lastError && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{server.lastError}</p>
                          {server.lastErrorAt && (
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(server.lastErrorAt), { addSuffix: true })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {server.lastSuccessfulAuthAt && (
                      <Tooltip>
                        <TooltipTrigger>
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Last authenticated {formatDistanceToNow(new Date(server.lastSuccessfulAuthAt), { addSuffix: true })}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>{new Date(server.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => testConnection(server.id)}
                      disabled={testConnectionMutation.isPending}
                    >
                      {testConnectionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(server.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/servers/${server.id}/streams`)}
                    >
                      View Streams
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
