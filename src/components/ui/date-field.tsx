"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function DateField({
  id,
  name,
  defaultValue,
  placeholder = "Pick a date",
  className,
}: {
  id?: string
  name: string
  defaultValue?: Date | string | null
  placeholder?: string
  className?: string
}) {
  const initial = defaultValue
    ? typeof defaultValue === "string"
      ? new Date(defaultValue)
      : defaultValue
    : undefined
  const [date, setDate] = React.useState<Date | undefined>(initial)
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <input type="hidden" name={name} value={date ? format(date, "yyyy-MM-dd") : ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start font-normal",
                !date && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <CalendarIcon className="size-4" />
          {date ? format(date, "PPP") : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            onSelect={(next) => {
              setDate(next)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

export { DateField }
