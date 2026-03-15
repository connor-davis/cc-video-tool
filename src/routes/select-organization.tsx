import { BuildingsIcon } from '@phosphor-icons/react';
import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { useState } from 'react';

import { toast } from 'sonner';

import { getAuthSuccessPath, useAuth } from '@/components/auth/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Route = createFileRoute('/select-organization')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: '/app' });
    }
  },
  component: SelectOrganizationRoute,
});

function SelectOrganizationRoute() {
  const navigate = useNavigate();
  const { pendingAuth, chooseOrganization, clearPendingAuth } = useAuth();
  const [organizationId, setOrganizationId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await chooseOrganization(organizationId);
      await navigate({ to: getAuthSuccessPath(result) });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to finish organization selection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pendingAuth?.step !== 'organization') {
    return (
      <AuthShell
        badge="Organization selection"
        title="No organization choice is pending"
        description="This route is only used when WorkOS asks the user to choose an organization context."
      >
        <Link
          className="inline-flex w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
          search={{ invitationToken: undefined }}
          to="/sign-in"
        >
          Return to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge="Organization selection"
      title="Choose where to sign in"
      description="WorkOS found more than one organization membership for this user. Select the organization context for this session."
      footer={
        <div className="flex w-full justify-between text-sm text-muted-foreground">
          <button
            className="font-medium text-primary hover:underline"
            onClick={clearPendingAuth}
            type="button"
          >
            Start over
          </button>
          <Link
            to="/sign-in"
            search={{ invitationToken: undefined }}
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel>Select your organization</FieldLabel>
            <FieldContent>
              <Select
                onValueChange={(value) => setOrganizationId(value ?? '')}
                value={organizationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an organization" />
                </SelectTrigger>
                <SelectContent>
                  {pendingAuth.organizations.map((organization) => (
                    <SelectItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldContent>
          </Field>
        </FieldGroup>

        <Button disabled={!organizationId || isSubmitting} type="submit">
          <BuildingsIcon data-icon="inline-start" />
          {isSubmitting ? 'Continuing...' : 'Continue'}
        </Button>
      </form>
    </AuthShell>
  );
}
