import { useEffect, useState } from 'react';
import { hasAcknowledgedDisclaimer, setDisclaimerAcknowledged } from '../lib/session';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { AlertTriangle } from 'lucide-react';

interface DisclaimerGateProps {
  acknowledged: boolean;
  onAcknowledge: () => void;
}

export default function DisclaimerGate({ acknowledged, onAcknowledge }: DisclaimerGateProps) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const hasAcknowledged = hasAcknowledgedDisclaimer();
    if (hasAcknowledged) {
      onAcknowledge();
    } else {
      setOpen(true);
    }
  }, [onAcknowledge]);

  const handleAccept = () => {
    if (checked) {
      setDisclaimerAcknowledged();
      onAcknowledge();
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Important Disclaimer
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left pt-4">
            <p className="text-base">
              <strong>Educational Purpose Only:</strong> This Trade Setup Analyzer is provided
              solely for educational and informational purposes. It is not intended to be, and
              should not be construed as, financial advice, investment advice, trading advice, or a
              recommendation to buy or sell any security or financial instrument.
            </p>
            <p className="text-base">
              <strong>Risk Warning:</strong> Trading stocks, options, futures, and other financial
              instruments involves substantial risk of loss and is not suitable for every investor.
              Past performance is not indicative of future results. You should carefully consider
              your financial situation and risk tolerance before making any trading decisions.
            </p>
            <p className="text-base">
              <strong>No Guarantees:</strong> The calculations and analyses provided by this tool
              are based on the inputs you provide and use simplified models. They do not account
              for all market conditions, fees, slippage, or other real-world factors that can
              significantly impact trading outcomes.
            </p>
            <p className="text-base">
              <strong>Consult Professionals:</strong> Before making any investment decisions, you
              should consult with a qualified financial advisor who can assess your individual
              circumstances and provide personalized advice.
            </p>
            <div className="flex items-start gap-3 pt-4 border-t">
              <Checkbox
                id="disclaimer-accept"
                checked={checked}
                onCheckedChange={(checked) => setChecked(checked === true)}
              />
              <Label
                htmlFor="disclaimer-accept"
                className="text-sm font-normal cursor-pointer leading-relaxed"
              >
                I understand and acknowledge that this tool is for educational purposes only, that
                trading involves substantial risk, and that I should not rely on this tool for
                actual trading decisions without consulting a qualified financial professional.
              </Label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleAccept} disabled={!checked}>
            I Understand and Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
