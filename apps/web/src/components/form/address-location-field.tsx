import { env } from "@church-task/env/web";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useId, useState } from "react";

import { getFieldErrors } from "@/components/form/field-helpers";
import { InputWrapper } from "@/components/form/input-wrapper";
import { useFieldContext } from "@/components/form/ts-field";
import { Input } from "@/components/ui/input";

export type CompositeAddressValue = {
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  url?: string;
};

export type AddressLocation = {
  id: string;
  name: string;
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  placeId: string;
  url?: string;
};

type GooglePlace = {
  id: string;
  formattedAddress: string;
  displayName?: { text: string };
  websiteUri?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  addressComponents?: Array<{
    longText: string;
    shortText?: string;
    types: Array<string>;
  }>;
};

function getAddressComponent(place: GooglePlace, types: Array<string>, getShortText = false) {
  for (const type of types) {
    const component = place.addressComponents?.find((item) => item.types.includes(type));
    if (component) {
      return getShortText ? component.shortText : component.longText;
    }
  }
}

function placeToAddressLocation(place: GooglePlace): AddressLocation {
  const streetNumber = getAddressComponent(place, ["street_number"]);
  const route = getAddressComponent(place, ["route"]);
  const name =
    place.displayName?.text ?? place.formattedAddress.split(",")[0] ?? "Unknown Location";

  return {
    city: getAddressComponent(place, ["locality", "postal_town"]),
    coordinates: place.location,
    countrycode: getAddressComponent(place, ["country"], true),
    id: place.id,
    name,
    placeId: place.id,
    postcode: getAddressComponent(place, ["postal_code"]),
    state: getAddressComponent(place, [
      "administrative_area_level_1",
      "administrative_area_level_2",
    ]),
    street: [streetNumber, route].filter(Boolean).join(" "),
    url: place.websiteUri,
  };
}

function locationToCompositeValue(location: AddressLocation): CompositeAddressValue {
  return {
    city: location.city,
    countryCode: location.countrycode,
    latitude: location.coordinates.latitude,
    longitude: location.coordinates.longitude,
    name: location.name,
    state: location.state,
    street: location.street,
    url: location.url,
    zip: location.postcode,
  };
}

type AddressLocationFieldProps = {
  label?: ReactNode;
  labelClassName?: string;
  wrapperClassName?: string;
  errorClassName?: string;
  placeholder?: string;
  required?: boolean;
  onLocationSelect?: (location: AddressLocation | null) => void;
} & Omit<ComponentProps<typeof Input>, "onChange" | "value">;

export function AddressLocationField({
  label,
  labelClassName,
  wrapperClassName,
  errorClassName,
  placeholder = "Search for a church address...",
  required = false,
  onLocationSelect,
  ...domProps
}: AddressLocationFieldProps) {
  const field = useFieldContext<CompositeAddressValue | null>();
  const { processedError } = getFieldErrors(field.state.meta.errors);
  const [query, setQuery] = useState(field.state.value?.name ?? "");
  const [locations, setLocations] = useState<Array<AddressLocation>>([]);
  const listId = useId();

  useEffect(() => {
    if (!env.VITE_GOOGLE_PLACES_API_KEY || query.trim().length < 3) {
      setLocations([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        body: JSON.stringify({ textQuery: query }),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": env.VITE_GOOGLE_PLACES_API_KEY ?? "",
          "X-Goog-FieldMask":
            "places.id,places.formattedAddress,places.addressComponents,places.location,places.displayName,places.websiteUri",
        },
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        setLocations([]);
        return;
      }

      const json = (await response.json()) as { places?: Array<GooglePlace> };
      setLocations((json.places ?? []).map(placeToAddressLocation));
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  return (
    <InputWrapper
      className={wrapperClassName}
      errorClassName={errorClassName}
      label={label}
      labelClassName={labelClassName}
      name={field.name}
      processedError={processedError}
      required={required}
    >
      <Input
        aria-invalid={Boolean(processedError)}
        list={listId}
        id={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          const selectedLocation = locations.find((location) => location.name === nextQuery);

          if (selectedLocation) {
            field.handleChange(locationToCompositeValue(selectedLocation));
            onLocationSelect?.(selectedLocation);
            return;
          }

          field.handleChange({ ...field.state.value, name: nextQuery });
          onLocationSelect?.(null);
        }}
        placeholder={placeholder}
        value={query}
        {...domProps}
      />
      <datalist id={listId}>
        {locations.map((location) => (
          <option key={location.id} value={location.name}>
            {location.street}, {location.city}, {location.state}
          </option>
        ))}
      </datalist>
    </InputWrapper>
  );
}
