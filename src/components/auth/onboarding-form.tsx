"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeProfile, type ProfileFormState } from "@/lib/actions/profile";
import { DEPARTMENTS, POSITIONS } from "@/lib/constants/org";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, formAction, pending] = useActionState<
    ProfileFormState,
    FormData
  >(completeProfile, {});

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Complete your profile</CardTitle>
        <CardDescription>
          Tell us who you are so the maintenance admin can set up your access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
        <form className="space-y-4" action={formAction} suppressHydrationWarning>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={defaultName}
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select name="department" required>
              <SelectTrigger id="department" className="w-full">
                <SelectValue placeholder="Select your department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Select name="position" required>
              <SelectTrigger id="position" className="w-full">
                <SelectValue placeholder="Select your position" />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
        </form>
        {state.error && (
          <p
            role="alert"
            className="border-destructive/30 text-destructive mt-4 rounded-md border bg-destructive/5 p-2.5 text-xs"
          >
            {state.error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Your details go to higher management for review — you&apos;ll get
          access once a role is assigned.
        </p>
      </CardFooter>
    </Card>
  );
}
