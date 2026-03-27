const fs = require('fs');
const file = 'c:/studio-main/studio-main/src/app/dashboard/registrations/page.tsx';
const content = fs.readFileSync(file, 'utf8');

const targetStr =   const handleUpdateDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isProcessing) return
    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    const updateData = {
      fullName: (formData.get("fullName") as string).toUpperCase(),
      ciNumber: formData.get("ciNumber") as string,
      phone: formData.get("phone") as string,
      groupId: formData.get("groupId") as string,
      catechesisYear: formData.get("catechesisYear") as string,
      paymentMethod: editPaymentMethod,
      photoUrl: editPhotoUrl,
      motherName: (formData.get("motherName") as string || "").toUpperCase(),
      motherPhone: formData.get("motherPhone") as string || "",
      fatherName: (formData.get("fatherName") as string || "").toUpperCase(),
      fatherPhone: formData.get("fatherPhone") as string || "",
      baptismParish: formData.get("baptismParish") as string || "",
      baptismBook: formData.get("baptismBook") as string || "",
      baptismFolio: formData.get("baptismFolio") as string || "",
      updatedAt: serverTimestamp()
    }
    const regRef = doc(db, "confirmations", selectedReg.id)
    updateDoc(regRef, updateData)
      .then(() => { toast({ title: "Ficha actualizada" }); setIsDetailsOpen(false); })
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: regRef.path, operation: 'update', requestResourceData: updateData })); })
      .finally(() => setIsProcessing(false))
  };

const replacementStr =   const handleUpdateDetails = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!db || !selectedReg || isProcessing) return
    setIsProcessing(true)
    const formData = new FormData(e.currentTarget)
    
    // Safely fallback to selectedReg values if the tab is hidden (unmounted by Radix)
    const updateData = {
      fullName: (formData.get("fullName") as string || selectedReg.fullName || "").toUpperCase(),
      ciNumber: formData.get("ciNumber") as string || selectedReg.ciNumber || "",
      phone: formData.get("phone") as string || selectedReg.phone || "",
      groupId: formData.get("groupId") as string || selectedReg.groupId || "none",
      catechesisYear: formData.get("catechesisYear") as string || selectedReg.catechesisYear || "",
      paymentMethod: editPaymentMethod,
      photoUrl: editPhotoUrl !== undefined ? editPhotoUrl : selectedReg.photoUrl,
      motherName: (formData.get("motherName") as string || selectedReg.motherName || "").toUpperCase(),
      motherPhone: formData.get("motherPhone") as string || selectedReg.motherPhone || "",
      fatherName: (formData.get("fatherName") as string || selectedReg.fatherName || "").toUpperCase(),
      fatherPhone: formData.get("fatherPhone") as string || selectedReg.fatherPhone || "",
      baptismParish: formData.get("baptismParish") as string || selectedReg.baptismParish || "",
      baptismBook: formData.get("baptismBook") as string || selectedReg.baptismBook || "",
      baptismFolio: formData.get("baptismFolio") as string || selectedReg.baptismFolio || "",
      updatedAt: serverTimestamp()
    }
    const regRef = doc(db, "confirmations", selectedReg.id)
    updateDoc(regRef, updateData)
      .then(() => { toast({ title: "Ficha actualizada" }); setIsDetailsOpen(false); })
      .catch(async (error) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: regRef.path, operation: 'update', requestResourceData: updateData })); })
      .finally(() => setIsProcessing(false))
  };

if (content.indexOf(targetStr) !== -1) {
    const newContent = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, newContent, 'utf8');
    console.log("Success: Replaced handleUpdateDetails!");
} else {
    console.log("Error: Target code blocks not found strictly. Attempting fallback regex...");
    let code = content;
    code = code.replace(/fullName: \\(formData\\.get\\("fullName"\\) as string\\)\\.toUpperCase\\(\\),/g, "fullName: (formData.get('fullName') as string || selectedReg.fullName || '').toUpperCase(),");
    code = code.replace(/ciNumber: formData\\.get\\("ciNumber"\\) as string,/g, "ciNumber: formData.get('ciNumber') as string || selectedReg.ciNumber || '',");
    code = code.replace(/phone: formData\\.get\\("phone"\\) as string,/g, "phone: formData.get('phone') as string || selectedReg.phone || '',");
    code = code.replace(/groupId: formData\\.get\\("groupId"\\) as string,/g, "groupId: formData.get('groupId') as string || selectedReg.groupId || 'none',");
    code = code.replace(/catechesisYear: formData\\.get\\("catechesisYear"\\) as string,/g, "catechesisYear: formData.get('catechesisYear') as string || selectedReg.catechesisYear || '',");
    code = code.replace(/photoUrl: editPhotoUrl,/g, "photoUrl: editPhotoUrl !== undefined ? editPhotoUrl : selectedReg.photoUrl,");
    code = code.replace(/motherName: \\(formData\\.get\\("motherName"\\) as string \\|\\| ""\\)\\.toUpperCase\\(\\),/g, "motherName: (formData.get('motherName') as string || selectedReg.motherName || '').toUpperCase(),");
    code = code.replace(/motherPhone: formData\\.get\\("motherPhone"\\) as string \\|\\| "",/g, "motherPhone: formData.get('motherPhone') as string || selectedReg.motherPhone || '',");
    code = code.replace(/fatherName: \\(formData\\.get\\("fatherName"\\) as string \\|\\| ""\\)\\.toUpperCase\\(\\),/g, "fatherName: (formData.get('fatherName') as string || selectedReg.fatherName || '').toUpperCase(),");
    code = code.replace(/fatherPhone: formData\\.get\\("fatherPhone"\\) as string \\|\\| "",/g, "fatherPhone: formData.get('fatherPhone') as string || selectedReg.fatherPhone || '',");
    code = code.replace(/baptismParish: formData\\.get\\("baptismParish"\\) as string \\|\\| "",/g, "baptismParish: formData.get('baptismParish') as string || selectedReg.baptismParish || '',");
    code = code.replace(/baptismBook: formData\\.get\\("baptismBook"\\) as string \\|\\| "",/g, "baptismBook: formData.get('baptismBook') as string || selectedReg.baptismBook || '',");
    code = code.replace(/baptismFolio: formData\\.get\\("baptismFolio"\\) as string \\|\\| "",/g, "baptismFolio: formData.get('baptismFolio') as string || selectedReg.baptismFolio || '',");
    if (code !== content) {
        fs.writeFileSync(file, code, 'utf8');
        console.log("Success: Regex fallback applied!");
    } else {
        console.log("Failed entirely.");
    }
}
