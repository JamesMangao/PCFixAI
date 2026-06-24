import { motion } from 'framer-motion';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { executeFix } from '../../hooks/useTauriEvents';

export function ScanReview() {
  const { findings, setScanPhase } = useStore();

  async function handleConfirmFix() {
    setScanPhase({ phase: 'fixing', message: 'Applying fixes...' });
    for (const finding of findings) {
      if (finding.fixAvailable) {
        // Assuming executeFix is an async function that communicates with the backend
        await executeFix(finding.category, finding.title);
      }
    }
    // Optionally, re-scan to confirm fixes or just move to complete
    setScanPhase({ phase: 'complete', message: 'Fixes applied successfully.' });
  }

  function handleCancel() {
    setScanPhase({ phase: 'idle', message: '' });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
    >
      <Card className="w-full max-w-2xl mx-4">
        <CardHeader>
          <CardTitle>Scan Complete: {findings.length} Issues Found</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[60vh] overflow-y-auto">
          <ul className="space-y-2">
            {findings.map((finding, index) => (
              <li key={index} className="p-3 rounded-md bg-secondary">
                <p className="font-semibold">{finding.title}</p>
                <p className="text-sm text-muted-foreground">{finding.description}</p>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="flex justify-end space-x-4">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirmFix}>Diagnose Now</Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}