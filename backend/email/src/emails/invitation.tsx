import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { FC } from "react";

type BetterAuthInviteUserEmailProps = {
  readonly username?: string;
  readonly invitedByUsername?: string;
  readonly invitedByEmail?: string;
  readonly churchName?: string;
  readonly churchImage?: string;
  readonly inviteLink?: string;
  readonly appName: string;
};

export const InviteUserEmail: FC<BetterAuthInviteUserEmailProps> = (props) => {
  const {
    username,
    invitedByUsername,
    invitedByEmail,
    churchName,
    churchImage,
    inviteLink,
    appName,
  } = props;
  const previewText = `Join ${churchName ?? "a church"} on ${appName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-white px-2 font-sans">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded border border-[#eaeaea] border-solid p-[20px]">
            <Heading className="mx-0 my-[30px] p-0 text-center font-normal text-[24px] text-black">
              Join <strong>{churchName}</strong> on <strong>{appName}.</strong>
            </Heading>
            <Text className="text-[14px] text-black leading-[24px]">Hello there,</Text>
            <Text className="text-[14px] text-black leading-[24px]">
              <strong>{invitedByUsername}</strong> (
              <Link className="text-blue-600 no-underline" href={`mailto:${invitedByEmail}`}>
                {invitedByEmail}
              </Link>
              ) has invited you to join <strong>{churchName}</strong> on <strong>{appName}</strong>.
            </Text>
            <Section>
              {churchImage ? (
                <Row>
                  <Column align="left">
                    <Img
                      className="rounded-full"
                      fetchPriority="high"
                      height="64"
                      src={churchImage}
                      width="64"
                    />
                  </Column>
                </Row>
              ) : null}
            </Section>
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center font-semibold text-[12px] text-white no-underline"
                href={inviteLink}
              >
                Accept invitation
              </Button>
            </Section>
            <Text className="text-[14px] text-black leading-[24px]">
              or copy and paste this URL into your browser:{" "}
              <Link className="text-blue-600 no-underline" href={inviteLink}>
                {inviteLink}
              </Link>
            </Text>
            <Hr className="mx-0 my-[26px] w-full border border-[#eaeaea] border-solid" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              This invitation was intended for <span className="text-black">{username}</span>. If
              you were not expecting this invitation, you can ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactInvitationEmail(props: BetterAuthInviteUserEmailProps) {
  return <InviteUserEmail {...props} />;
}

export default InviteUserEmail;
